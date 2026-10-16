import assert from 'node:assert/strict'
import test from 'node:test'
import { exportHarvest, planHarvest } from '../src/harvest.mjs'

export const fixture = () => ({
  format: 'nuxt-customer-portal/harvest-v1',
  accountId: '123',
  exportedAt: '2026-10-15T12:00:00Z',
  clients: [{ id: 1, name: 'Customer', address: 'Example street', currency: 'EUR', is_active: true }],
  contacts: [{ id: 2, client: { id: 1 }, first_name: 'Contact', email: 'contact@example.test' }],
  users: [{ id: 3, email: 'owner@example.test' }],
  tasks: [{ id: 4, name: 'Development', billable_by_default: true, is_active: true }],
  projects: [{ id: 5, client: { id: 1 }, name: 'Website', is_active: true }],
  task_assignments: [{ id: 6, project_id: 5, task: { id: 4 } }],
  time_entries: [
    {
      id: 7,
      user: { id: 3 },
      client: { id: 1 },
      project: { id: 5 },
      task: { id: 4 },
      invoice: { id: 8 },
      spent_date: '2026-10-14',
      hours: 2,
      billable_rate: 50,
      billable: true,
      is_billed: true,
      approval_status: 'approved'
    }
  ],
  invoices: [
    {
      id: 8,
      client: { id: 1 },
      number: '2026-001',
      state: 'paid',
      currency: 'EUR',
      amount: 108.9,
      due_amount: 0,
      tax: 21,
      tax_amount: 18.9,
      discount: 10,
      discount_amount: 10,
      issue_date: '2026-10-14',
      due_date: '2026-10-28',
      line_items: [
        {
          id: 9,
          project: { id: 5 },
          kind: 'Hours',
          description: 'Development',
          quantity: 2,
          unit_price: 50,
          amount: 100,
          taxed: true
        }
      ]
    }
  ],
  payments: [{ id: 10, invoice_id: 8, amount: 108.9, paid_date: '2026-10-15' }]
})
const options = {
  provider: 'provider',
  actorId: 'owner',
  users: { 3: 'owner' },
  sender: { name: 'Agency', currency: 'EUR' }
}

test('Harvest plan retains time, invoices, exact discounted tax, payments and billed links', () => {
  const plan = planHarvest(fixture(), options)
  assert.deepEqual(plan.errors, [])
  assert.deepEqual(plan.warnings, [])
  const row = (table: string) => plan.rows.find((row) => row.table === table)!.data
  assert.equal(row('invoices.invoice').number, '2026-001')
  assert.equal(row('invoices.invoice').status, 'PAID')
  assert.equal(row('invoices.invoice_line').exact_tax_minor, 1890)
  assert.equal(row('invoices.invoice_payment').amount_minor, 10890)
  assert.equal(row('invoices.invoice_payment').paid_on, '2026-10-15')
  assert.equal(row('timesheets.time_entry').duration_minutes, 120)
  assert.equal(row('timesheets.weekly_timesheet').week_starts_on, '2026-10-12')
  assert.equal(row('timesheets.submission').status, 'APPROVED')
  assert.equal(row('invoice_timesheets.invoice_time_entry').time_entry_id, row('timesheets.time_entry').id)
  assert.equal(row('invoice_timesheets.invoice_time_entry').invoice_line_id, row('invoices.invoice_line').id)
  assert.equal(row('invoices.billing_contact').email, 'contact@example.test')
  assert.equal(row('timesheets.workspace_client').access_mode, 'DISABLED')
  assert.equal(plan.rows.filter((row) => row.table === 'timesheets.project_activity').length, 1)
  assert.equal(plan.fingerprint, planHarvest(fixture(), options).fingerprint)
})

test('source IDs are scoped to account and provider, and mapping reuses explicit clients', () => {
  const snapshot = fixture()
  const a = planHarvest(snapshot, options)
  const b = planHarvest({ ...snapshot, accountId: '456' }, options)
  assert.notEqual(a.rows[0].data.id, b.rows[0].data.id)
  const mapped = planHarvest(snapshot, { ...options, clients: { 1: 'existing-client' } })
  assert.ok(!mapped.rows.some((row) => row.table === 'public.organization'))
  assert.equal(
    mapped.rows.find((row) => row.table === 'timesheets.project')!.data.client_organization_id,
    'existing-client'
  )
})

test('import blocks missing users, running timers and inconsistent payments while retaining unlinked billed time', () => {
  assert.match(planHarvest(fixture(), { ...options, users: {} }).errors.join(), /Map Harvest user 3/)
  const snapshot = fixture()
  Object.assign(snapshot.time_entries[0], { is_running: true })
  assert.match(planHarvest(snapshot, options).errors.join(), /running Harvest timer/)
  Object.assign(snapshot.time_entries[0], { is_running: false, invoice: null })
  const historical = planHarvest(snapshot, options)
  assert.deepEqual(historical.errors, [])
  assert.equal(historical.rows.find((row) => row.table === 'timesheets.time_entry')!.data.externally_billed, true)
  assert.ok(!historical.rows.some((row) => row.table === 'invoice_timesheets.invoice_time_entry'))
  const mismatch = fixture()
  mismatch.payments[0].amount = 100
  assert.match(planHarvest(mismatch, options).errors.join(), /Payments do not reconcile/)
})

test('unsupported invoice states, precision loss and totals block the entire plan', () => {
  for (const [patch, expected] of [
    [{ state: 'unknown' }, /Unsupported invoice state/],
    [{ amount: 109 }, /Invoice total does not reconcile/],
    [{ currency: 'JPY' }, /two decimal/]
  ] as const) {
    const snapshot = fixture()
    Object.assign(snapshot.invoices[0], patch)
    assert.match(planHarvest(snapshot, options).errors.join(), expected)
  }
  const snapshot = fixture()
  snapshot.invoices[0].line_items[0].unit_price = 50.006
  assert.match(planHarvest(snapshot, options).errors.join(), /exceeds portal precision/)
  const duplicate = fixture()
  duplicate.clients.push({ ...duplicate.clients[0] })
  assert.throws(() => planHarvest(duplicate, options), /Duplicate Harvest clients/)
})

test('time rounding is disclosed and week boundaries use configured UTC calendar arithmetic', () => {
  const snapshot = fixture()
  snapshot.time_entries[0].hours = 2.11
  snapshot.time_entries[0].spent_date = '2026-10-11'
  const plan = planHarvest(snapshot, { ...options, weekStartsOn: 0 })
  assert.match(plan.warnings.join(), /rounded to 127 minutes/)
  assert.equal(plan.rows.find((row) => row.table === 'timesheets.weekly_timesheet')!.data.week_starts_on, '2026-10-11')
})

test('export handles cursor pagination and retries without sending credentials to other origins', async () => {
  const requests: string[] = []
  let retried = false
  const fetchImpl = async (url: string, init: RequestInit) => {
    requests.push(url)
    assert.equal((init.headers as Record<string, string>).Authorization, 'Bearer secret')
    assert.equal(init.redirect, 'error')
    const path = new URL(url).pathname.replace('/v2/', '')
    if (path === 'users/me') {
      return Response.json({ is_admin: true })
    }
    if (path === 'clients' && !retried) {
      retried = true
      return new Response('', { status: 429 })
    }
    if (path === 'clients' && !url.includes('cursor=')) {
      return Response.json({
        clients: [{ id: 1 }],
        links: { next: 'https://api.harvestapp.com/v2/clients?cursor=next' }
      })
    }
    if (path === 'clients') {
      return Response.json({ clients: [{ id: 2 }], links: { next: null } })
    }
    return Response.json({ [path]: [], next_page: null })
  }
  const snapshot = await exportHarvest({ token: 'secret', accountId: '123', fetchImpl, sleep: async () => {} })
  assert.deepEqual(
    snapshot.clients.map((client) => client.id),
    [1, 2]
  )
  assert.ok(requests.some((url) => url.endsWith('cursor=next')))
  assert.ok(!JSON.stringify(snapshot).includes('secret'))
  await assert.rejects(
    exportHarvest({
      token: 'secret',
      accountId: '123',
      fetchImpl: async (url: string) =>
        url.endsWith('users/me')
          ? Response.json({ is_admin: true })
          : Response.json({ clients: [], links: { next: 'https://evil.example/v2/clients' } })
    }),
    /Invalid Harvest pagination URL/
  )
})

test('export refuses incomplete account access and sanitizes HTTP errors', async () => {
  await assert.rejects(
    exportHarvest({ token: 'secret', accountId: '123', fetchImpl: async () => Response.json({ is_admin: false }) }),
    /administrator token/
  )
  await assert.rejects(
    exportHarvest({
      token: 'secret',
      accountId: '123',
      fetchImpl: async () => new Response('secret', { status: 401 })
    }),
    /Harvest returned 401/
  )
})

test(
  'Harvest database preview, atomic rollback, apply and identical retry use real package schemas',
  { skip: !process.env.HARVEST_TEST_DATABASE_URL },
  async () => {
    const { readFile, readdir } = await import('node:fs/promises')
    const { default: pg } = await import('pg')
    const { importHarvest } = await import('../src/harvest.mjs')
    const databaseUrl = process.env.HARVEST_TEST_DATABASE_URL!
    assert.match(new URL(databaseUrl).pathname, /^\/portal_harvest_test(?:_[a-z0-9]+)?$/)
    const pool = new pg.Pool({ connectionString: databaseUrl })
    try {
      for (const module of ['core', 'clients', 'timesheets', 'invoices', 'invoice-timesheets']) {
        const directory = new URL(`../../${module}/migrations/`, import.meta.url)
        for (const file of (await readdir(directory)).filter((file) => file.endsWith('.sql')).sort()) {
          await pool.query(`SET search_path TO ${module === 'timesheets' ? 'timesheets, public' : 'public'}`)
          await pool.query(await readFile(new URL(file, directory), 'utf8'))
        }
      }
      await pool.query(`SET search_path TO public`)
      await pool.query(
        `INSERT INTO organization (id,name,slug,created_at,organization_type) VALUES ('provider','Agency','agency',now(),'PROVIDER')`
      )
      await pool.query(
        `INSERT INTO "user" (id,name,email,email_verified,created_at,updated_at) VALUES ('owner','Owner','owner@example.test',true,now(),now())`
      )
      await pool.query(
        `INSERT INTO member (id,organization_id,user_id,role,created_at) VALUES ('member','provider','owner','owner',now())`
      )
      await pool.query(
        `INSERT INTO timesheets.workspace_settings (organization_id,workspace_enabled) VALUES ('provider',true)`
      )
      await pool.query(`INSERT INTO invoices.settings (organization_id,enabled) VALUES ('provider',true)`)
      const input = {
        databaseUrl,
        provider: 'agency',
        actorEmail: 'owner@example.test',
        mapping: { users: { 3: 'owner@example.test' } }
      }
      const preview = await importHarvest(fixture(), input)
      assert.deepEqual(preview.errors, [])
      assert.equal(preview.dryRun, true)
      assert.equal((await pool.query('SELECT count(*)::int AS count FROM invoices.invoice')).rows[0].count, 0)
      assert.equal(
        (await pool.query("SELECT to_regclass('nuxt_customer_portal_migrations.harvest_import') AS name")).rows[0].name,
        null
      )
      await assert.rejects(importHarvest(fixture(), { ...input, apply: true }), /backup-confirmed/)
      // A failure near the end must roll back clients, projects, time and invoices.
      await pool.query(
        `CREATE FUNCTION reject_harvest_history() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'injected import failure'; END $$`
      )
      await pool.query(
        `CREATE TRIGGER reject_harvest_history BEFORE INSERT ON invoices.invoice_history FOR EACH ROW EXECUTE FUNCTION reject_harvest_history()`
      )
      await assert.rejects(
        importHarvest(fixture(), { ...input, apply: true, backupConfirmed: true }),
        /injected import failure/
      )
      assert.equal((await pool.query('SELECT count(*)::int AS count FROM clients.client_profile')).rows[0].count, 0)
      assert.equal((await pool.query('SELECT count(*)::int AS count FROM invoices.invoice')).rows[0].count, 0)
      await pool.query(`DROP TRIGGER reject_harvest_history ON invoices.invoice_history`)
      const result = await importHarvest(fixture(), { ...input, apply: true, backupConfirmed: true })
      assert.equal(result.dryRun, false)
      const totals = await pool.query(
        `SELECT sum(round(quantity_milli * unit_price_minor::numeric / 1000) + exact_tax_minor)::int AS total FROM invoices.invoice_line`
      )
      assert.equal(totals.rows[0].total, 10890)
      assert.equal(
        (await pool.query('SELECT count(*)::int AS count FROM invoice_timesheets.invoice_time_entry')).rows[0].count,
        1
      )
      assert.equal(
        (await pool.query('SELECT count(*)::int AS count FROM invoices.invoice_email_delivery')).rows[0].count,
        0
      )
      assert.equal(
        (await importHarvest(fixture(), { ...input, apply: true, backupConfirmed: true })).alreadyImported,
        true
      )
      assert.equal((await pool.query('SELECT count(*)::int AS count FROM invoices.invoice')).rows[0].count, 1)
      const changed = fixture()
      changed.clients[0].name = 'Changed'
      await assert.rejects(importHarvest(changed, input), /different data or mappings/)
      const conflicting = fixture()
      conflicting.accountId = '456'
      const conflicts = await importHarvest(conflicting, input)
      assert.match(conflicts.errors.join(), /Existing record conflicts/)
    } finally {
      await pool.end()
    }
  }
)

test('historical users remain distinct, disabled and attributed without credentials or invitations', () => {
  const snapshot = fixture()
  snapshot.users.push({
    id: 11,
    email: 'former@example.test',
    first_name: 'Former',
    last_name: 'Member',
    is_active: false
  })
  snapshot.users.push({
    id: 12,
    email: 'older@example.test',
    first_name: 'Former',
    last_name: 'Member',
    is_active: false
  })
  snapshot.time_entries.push({ ...snapshot.time_entries[0], id: 13, user: { id: 11 } })
  snapshot.invoices[0].creator = { id: 12 }
  const plan = planHarvest(snapshot, { ...options, createHistoricalUsers: true })
  assert.deepEqual(plan.errors, [])
  const people = plan.rows.filter((row) => row.table === 'public.user').map((row) => row.data)
  assert.equal(people.length, 2)
  assert.notEqual(people[0].id, people[1].id)
  assert.ok(people.every((person) => person.banned && !person.email_verified))
  assert.ok(
    plan.rows.filter((row) => row.table === 'timesheets.team_member_settings').every((row) => !row.data.can_enter_time)
  )
  assert.equal(plan.rows.find((row) => row.table === 'invoices.invoice')!.data.created_by_id, people[1].id)
  assert.equal(plan.rows.filter((row) => row.table === 'timesheets.time_entry')[1].data.user_id, people[0].id)
  assert.ok(!plan.rows.some((row) => ['public.account', 'public.invitation'].includes(row.table)))
})

test('duplicate projects keep distinct IDs and contact consolidation retains every source record', () => {
  const snapshot = fixture()
  snapshot.projects.push({ ...snapshot.projects[0], id: 11 })
  snapshot.contacts.push({ ...snapshot.contacts[0], id: 12, first_name: 'Another', email: 'CONTACT@example.test' })
  const plan = planHarvest(snapshot, options)
  assert.deepEqual(plan.errors, [])
  const projects = plan.rows.filter((row) => row.table === 'timesheets.project')
  assert.notEqual(projects[0].data.name, projects[1].data.name)
  assert.notEqual(projects[0].data.id, projects[1].data.id)
  assert.equal(plan.transformations.renamedProjects.length, 2)
  assert.equal(plan.rows.filter((row) => row.table === 'invoices.billing_contact').length, 1)
  assert.deepEqual(plan.transformations.mergedContacts[0].sourceIds, [2, 12])
  assert.match(plan.rows.find((row) => row.table === 'invoices.billing_contact')!.data.name, /Another/)
})

test('credits and written-off history retain signed values, payment actors and original timestamps', () => {
  const snapshot = fixture()
  const invoice = snapshot.invoices[0]
  invoice.amount = -108.9
  invoice.discount_amount = -10
  invoice.tax_amount = -18.9
  invoice.line_items[0].unit_price = -50
  invoice.line_items[0].amount = -100
  Object.assign(invoice, { creator: { id: 3 }, created_at: '2020-01-01T10:00:00Z', sent_at: '2020-01-02T10:00:00Z' })
  snapshot.payments[0].amount = -108.9
  Object.assign(snapshot.payments[0], { recorded_by_email: 'owner@example.test', paid_at: '2020-01-03T10:00:00Z' })
  const credit = planHarvest(snapshot, options)
  assert.deepEqual(credit.errors, [])
  const document = credit.rows.find((row) => row.table === 'invoices.invoice')!.data
  assert.equal(document.document_type, 'credit')
  assert.equal(document.import_metadata.invoice.amount, -108.9)
  assert.equal(credit.rows.find((row) => row.table === 'invoices.invoice_payment')!.data.amount_minor, -10890)
  assert.equal(
    credit.rows.find((row) => row.table === 'invoices.invoice_history' && row.data.action === 'ISSUED')!.data
      .created_at,
    invoice.sent_at
  )
  assert.equal(
    credit.rows.find((row) => row.table === 'invoices.invoice_history' && row.data.action === 'PAYMENT_REGISTERED')!
      .data.actor_user_id,
    'owner'
  )
  invoice.state = 'closed'
  invoice.due_amount = -108.9
  Object.assign(invoice, { closed_at: '2020-01-04T10:00:00Z' })
  snapshot.payments = []
  const closed = planHarvest(snapshot, options)
  assert.deepEqual(closed.errors, [])
  assert.equal(closed.rows.find((row) => row.table === 'invoices.invoice')!.data.status, 'VOID')
  assert.equal(
    closed.rows.find((row) => row.table === 'invoices.invoice_history' && row.data.action === 'VOIDED')!.data
      .amount_minor,
    -10890
  )
  assert.equal(
    closed.rows.find((row) => row.table === 'invoices.invoice')!.data.import_metadata.invoice.state,
    'closed'
  )
})
