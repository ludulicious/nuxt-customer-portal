import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { runInNewContext } from 'node:vm'
import { Client } from 'pg'
import ts from 'typescript'
import { defaultPlanningPolicy } from '../../products/shared/planning'

function functions(path: string, names: string[]) {
  const source = readFileSync(new URL(path, import.meta.url), 'utf8')
  const parsed = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true)
  return ts.transpileModule(
    parsed.statements
      .filter((statement) => ts.isFunctionDeclaration(statement) && names.includes(statement.name!.text))
      .map((statement) => statement.getText(parsed))
      .join('\n'),
    { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }
  ).outputText
}
const providerSource = functions('../server/utils/booking.ts', ['providers'])
const staffSource = functions('../server/utils/staff-appointments.ts', ['staffReschedule'])
const createError = (error: { message: string; statusCode: number }) => Object.assign(new Error(error.message), error)

function providerHarness(rows: (sql: string, params: unknown[]) => Promise<unknown[]>, sandbox = false) {
  const product = {
    status: 'published',
    planning: { enabled: true, providerUserIds: ['host'], meetingProvider: 'zoom' }
  }
  const exports = {} as typeof import('../server/utils/booking')
  runInNewContext(providerSource, {
    exports,
    rows,
    getEffectiveProduct: async () => product,
    getStore: async () => ({ mode: sandbox ? 'sandbox' : 'live' }),
    developmentSandboxEffectsEnabled: () => false,
    createError
  })
  return { product, providers: exports.providers }
}

test('Zoom products require calendar eligibility but never require Zoom authorization', async () => {
  const fixture = providerHarness(async (sql, params) => {
    assert.doesNotMatch(sql, /zoom/)
    assert.match(sql, /JOIN public.member/)
    assert.match(sql, /p\.enabled/)
    assert.match(sql, /p\.user_id=ANY\(\$2::text\[\]\)/)
    assert.match(sql, /p\.write_calendar_id IS NOT NULL/)
    assert.match(sql, /cardinality\(p\.busy_calendar_ids\)>0/)
    assert.match(sql, /c\.provider='google' AND c\.healthy/)
    assert.equal(params[0], 'store')
    assert.deepEqual(Array.from(params[1] as string[]), ['host'])
    assert.equal(params[2], false)
    assert.equal(params.length, 3)
    return [{ user_id: 'host' }]
  })
  assert.equal((await fixture.providers('store', 'product')).users[0]!.user_id, 'host')
})

test('unpublished or disabled booking products remain unavailable', async () => {
  const fixture = providerHarness(async () => assert.fail('Ineligible product queried providers'))
  fixture.product.status = 'draft'
  await assert.rejects(fixture.providers('store', 'product'), { statusCode: 404 })
  fixture.product.status = 'published'
  fixture.product.planning.enabled = false
  await assert.rejects(fixture.providers('store', 'product'), { statusCode: 404 })
})

test('sandbox still bypasses external connection eligibility', async () => {
  const fixture = providerHarness(async (sql, params) => {
    assert.match(sql, /\$3::boolean OR/)
    assert.equal(params[2], true)
    return [{ user_id: 'host' }]
  }, true)
  assert.equal((await fixture.providers('store', 'product')).users.length, 1)
})

function staffHarness(busy = false) {
  const queries: string[] = []
  const jobs: string[] = []
  const start = new Date(Date.now() + 3 * 86400000).toISOString()
  const appointment = {
    id: 'appointment',
    store_id: 'store',
    product_id: 'product',
    user_id: 'host',
    reservation_id: 'reservation',
    revision: 1,
    status: 'confirmed',
    start_at: new Date(start),
    snapshot: { durationMinutes: 30, meetingProvider: 'zoom', policy: defaultPlanningPolicy() }
  }
  const provider = {
    user_id: 'host',
    name: 'Host',
    timezone: 'UTC',
    grace_minutes: 0,
    busy_calendar_ids: ['calendar'],
    write_calendar_id: 'calendar'
  }
  const rows = async (sql: string) => {
    queries.push(sql)
    if (sql.startsWith('SELECT * FROM planning.appointment')) {
      return [appointment]
    }
    if (sql.startsWith('SELECT p.user_id')) {
      assert.match(sql, /c\.provider='google' AND c\.healthy/)
      return [{ user_id: 'host' }]
    }
    if (sql.startsWith('SELECT id FROM products.product')) {
      return [{ id: 'product' }]
    }
    return []
  }
  const exports = {} as typeof import('../server/utils/staff-appointments')
  runInNewContext(staffSource, {
    exports,
    rows,
    Date,
    Set,
    createError,
    planningAdmin: async () => {},
    parseInput: (_schema: unknown, input: unknown) => input,
    staffRescheduleSchema: {},
    appointmentAccess: async () => ({ appointment, userId: 'admin' }),
    providers: async () => ({ users: [provider] }),
    bookingBusy: async () => [],
    transaction: async (callback: (tx: unknown) => Promise<void>) =>
      callback({ query: async (sql: string) => queries.push(sql) }),
    auditLock: async () => {},
    lockProvider: async () => {},
    generateSlots: () => (busy ? [] : [{ start }]),
    randomUUID: () => 'new-reservation',
    digest: (value: string) => value,
    enqueue: async (_tx: unknown, _id: string, kind: string) => jobs.push(kind),
    refreshAvailability: async () => {}
  })
  return {
    queries,
    jobs,
    reschedule: () =>
      exports.staffReschedule({} as never, appointment.id, {
        providerUserId: 'host',
        start,
        customerTimezone: 'UTC',
        revision: 1
      })
  }
}

test('staff can reschedule Zoom appointments without a Zoom connection and still enqueue meeting effects', async () => {
  const fixture = staffHarness()
  assert.equal((await fixture.reschedule()).success, true)
  assert.equal(
    fixture.queries.some((sql) => sql.includes("provider='zoom'")),
    false
  )
  assert.ok(fixture.queries.some((sql) => sql.startsWith('UPDATE planning.appointment SET reservation_id=')))
  assert.deepEqual(fixture.jobs, ['appointment'])
})

test('staff rescheduling still rejects unavailable time slots', async () => {
  const fixture = staffHarness(true)
  await assert.rejects(fixture.reschedule(), { statusCode: 409 })
  assert.deepEqual(fixture.jobs, [])
})

test(
  'PostgreSQL eligibility permits missing or unhealthy Zoom but preserves all calendar and provider gates',
  { skip: !process.env.PLANNING_ELIGIBILITY_TEST_DATABASE_URL },
  async () => {
    const url = process.env.PLANNING_ELIGIBILITY_TEST_DATABASE_URL!
    assert.match(new URL(url).pathname, /^\/portal_planning_test_[a-z0-9]+$/)
    const client = new Client({ connectionString: url })
    await client.connect()
    try {
      await client.query('BEGIN')
      await client.query(`
        CREATE SCHEMA planning;
        CREATE TABLE public.member (organization_id text, user_id text);
        CREATE TABLE public."user" (id text, name text, email text);
        CREATE TABLE planning.provider (store_id text, user_id text, enabled boolean, write_calendar_id text, busy_calendar_ids text[]);
        CREATE TABLE planning.connection (store_id text, user_id text, provider text, healthy boolean);
        INSERT INTO public.member VALUES ('store','host');
        INSERT INTO public."user" VALUES ('host','Host','host@example.test');
        INSERT INTO planning.provider VALUES ('store','host',true,'calendar',ARRAY['calendar']);
        INSERT INTO planning.connection VALUES ('store','host','google',true);
      `)
      const fixture = providerHarness(async (sql, params) => (await client.query(sql, params)).rows)
      const eligible = async () => (await fixture.providers('store', 'product')).users.length
      assert.equal(await eligible(), 1)
      await client.query("INSERT INTO planning.connection VALUES ('store','host','zoom',false)")
      assert.equal(await eligible(), 1)
      await client.query("UPDATE planning.connection SET healthy=true WHERE provider='zoom'")
      assert.equal(await eligible(), 1)
      for (const [disable, restore] of [
        [
          "DELETE FROM planning.connection WHERE provider='google'",
          "INSERT INTO planning.connection VALUES ('store','host','google',true)"
        ],
        [
          "UPDATE planning.connection SET healthy=false WHERE provider='google'",
          "UPDATE planning.connection SET healthy=true WHERE provider='google'"
        ],
        ['UPDATE planning.provider SET enabled=false', 'UPDATE planning.provider SET enabled=true'],
        [
          'UPDATE planning.provider SET write_calendar_id=NULL',
          "UPDATE planning.provider SET write_calendar_id='calendar'"
        ],
        [
          "UPDATE planning.provider SET busy_calendar_ids='{}'",
          "UPDATE planning.provider SET busy_calendar_ids=ARRAY['calendar']"
        ],
        ['DELETE FROM public.member', "INSERT INTO public.member VALUES ('store','host')"]
      ]) {
        await client.query(disable!)
        assert.equal(await eligible(), 0)
        await client.query(restore!)
        assert.equal(await eligible(), 1)
      }
      assert.equal((await fixture.providers('other-store', 'product')).users.length, 0)
      fixture.product.planning.providerUserIds = []
      assert.equal(await eligible(), 0)
    } finally {
      await client.query('ROLLBACK')
      await client.end()
    }
  }
)
