import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { runInNewContext } from 'node:vm'
import test from 'node:test'
import ts from 'typescript'
import { formatTimesheetPeriod } from '../shared/timesheet-dates'
import { timesheetEmails } from '../shared/emails'
import { timesheetsFeature } from '../shared/feature'
import en from '../i18n/locales/en.json' with { type: 'json' }
import nl from '../i18n/locales/nl.json' with { type: 'json' }

type EmailInput = Parameters<typeof import('../../core/server/utils/portal-email').sendPortalEmail>[0]
type DeliveryModule = typeof import('../server/utils/timesheet-email')

const require = createRequire(import.meta.url)
const source = ts.transpileModule(
  readFileSync(new URL('../server/utils/timesheet-email.ts', import.meta.url), 'utf8'),
  {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
  }
).outputText

const submission = {
  id: 'submission',
  userId: 'submitter',
  organizationId: 'supplier',
  status: 'SUBMITTED',
  version: 1,
  periodStartsOn: '2026-09-01',
  periodEndsOn: '2026-09-03'
} as Parameters<DeliveryModule['notifyTimesheetEvent']>[0] & {}

const person = { id: 'submitter', email: 'submitter@example.com', name: '<script>Alex</script>' }
const workspace = { name: 'Supplier & Co' }

// Execute the actual delivery utility with database/provider boundaries replaced;
// these tests never contact a database or send real email.
const harness = (rows: unknown[][], failRecipient?: string) => {
  const sent: EmailInput[] = []
  const errors: unknown[] = []
  const query = () => {
    const result = rows.shift()
    assert.ok(result, 'Unexpected database query')
    const builder: Record<string, unknown> = {}
    for (const method of ['from', 'where', 'innerJoin', 'limit']) {
      builder[method] = () => builder
    }
    builder.then = (resolve: (value: unknown) => unknown) => Promise.resolve(result).then(resolve)
    return builder
  }
  const exports = {} as DeliveryModule
  runInNewContext(source, {
    exports,
    URL,
    URLSearchParams,
    process: { env: { PUBLIC_URL: 'https://portal.example.com' } },
    console: { error: (...args: unknown[]) => errors.push(args) },
    require: (id: string) => {
      if (id.endsWith('/client-email-locale')) {
        return { getClientEmailLocale: async () => 'en' }
      }
      if (id.endsWith('/server/portal')) {
        return { db: { select: query, selectDistinct: query } }
      }
      if (id.endsWith('/utils/portal-email')) {
        return {
          getPortalEmailSettings: async () => ({ defaultLocale: 'nl' }),
          sendPortalEmail: async (input: EmailInput) => {
            sent.push(input)
            if (input.to === failRecipient) {
              throw new Error('Provider unavailable')
            }
          }
        }
      }
      if (id === '../../shared/timesheet-dates') {
        return { formatTimesheetPeriod }
      }
      if (id === '../../shared/emails') {
        return { timesheetEmails }
      }
      if (id === '../db/schema/timesheets') {
        return require('../server/db/schema/timesheets')
      }
      return require(id)
    }
  })
  return { sent, errors, notify: exports.notifyTimesheetEvent, notifyClient: exports.notifyClientTimesheetEvent }
}

test('all approval email definitions are registered, translated and declare their placeholders', () => {
  assert.equal(timesheetsFeature.emails, timesheetEmails)
  assert.equal(timesheetEmails.length, 7)
  for (const definition of timesheetEmails) {
    for (const locale of ['en', 'nl'] as const) {
      const messages = (locale === 'en' ? en : nl).features.timesheets.email.messages
      assert.ok(messages[definition.id as keyof typeof messages])
      const allowed = new Set(definition.placeholders.map((item) => item.key))
      for (const value of Object.values(definition.defaults[locale])) {
        for (const match of value.matchAll(/{{(\w+)}}/g)) {
          assert.ok(allowed.has(match[1]!))
        }
      }
    }
  }
})

test('submission notifies reviewers individually and continues after provider failure', async () => {
  const h = harness(
    [
      [person],
      [workspace],
      [
        { id: 'r1', email: 'one@example.com' },
        { id: 'r2', email: 'two@example.com' }
      ]
    ],
    'one@example.com'
  )
  await h.notify(submission, 'submitted')
  assert.deepEqual(
    h.sent.map((mail) => mail.to),
    ['one@example.com', 'two@example.com']
  )
  assert.ok(h.sent.every((mail) => mail.definition.id === 'internal-requested'))
  assert.equal(
    h.sent[0].values.action_url,
    `https://portal.example.com/timesheets/internal-approvals?status=SUBMITTED&amp;userId=${submission.userId}`
  )
  assert.equal(h.sent[0].values.person_name, '&lt;script&gt;Alex&lt;/script&gt;')
  assert.equal(h.errors.length, 1)
})

test('automatic approval notifies the submitter and client reviewers without leaking review comments', async () => {
  const h = harness([
    [person],
    [workspace],
    [{ id: 'r1', email: 'client@example.com', clientName: 'Client A', reviewId: 'review-a', version: 1 }]
  ])
  await h.notify({ ...submission, status: 'APPROVED' }, 'submitted')
  assert.deepEqual(
    h.sent.map((mail) => mail.definition.id),
    ['internal-approved', 'client-requested']
  )
  assert.equal(h.sent[1].values.client_name, 'Client A')
  assert.equal(h.sent[0].locale, 'nl')
  assert.equal(h.sent[1].locale, 'en')
  assert.equal(h.sent[1].values.period, formatTimesheetPeriod(submission.periodStartsOn, submission.periodEndsOn, 'en'))
  assert.equal(h.sent[1].values.comment, '')
  assert.equal(
    h.sent[1].values.action_url,
    `https://portal.example.com/timesheets/approvals?status=PENDING&amp;userId=${submission.userId}`
  )
})

test('rejection and reopening notify only the submitter', async () => {
  for (const event of ['rejected', 'reopened'] as const) {
    const h = harness([[person], [workspace]])
    await h.notify(
      { ...submission, status: event === 'rejected' ? 'REJECTED' : 'DRAFT', rejectionComment: '<b>Fix hours</b>' },
      event
    )
    assert.equal(h.sent.length, 1)
    assert.equal(h.sent[0].to, person.email)
    assert.equal(h.sent[0].definition.id, `internal-${event}`)
    assert.equal(h.sent[0].values.comment, '&lt;b&gt;Fix hours&lt;/b&gt;')
  }
})

test('client outcomes include the client and comment, with distinct keys across reviews', async () => {
  const keys = new Set<string>()
  for (const status of ['APPROVED', 'DISPUTED']) {
    for (const version of [1, 2]) {
      const h = harness([[submission], [person], [workspace], [{ name: 'Client A' }]])
      await h.notifyClient({
        submissionId: submission.id,
        clientOrganizationId: 'client-a',
        status,
        version,
        comment: 'Please check <hours>'
      })
      assert.equal(h.sent.length, 1)
      assert.equal(h.sent[0].definition.id, status === 'APPROVED' ? 'client-approved' : 'client-disputed')
      assert.equal(h.sent[0].values.comment, 'Please check &lt;hours&gt;')
      assert.equal(h.sent[0].values.client_name, 'Client A')
      keys.add(h.sent[0].idempotencyKey)
    }
  }
  assert.equal(keys.size, 4)
})

test('period formatting handles single days and month/year boundaries in both languages', () => {
  assert.equal(formatTimesheetPeriod('2026-09-03', '2026-09-04', 'nl').replace(/\s/g, ' '), 'do 3 – vr 4 sep 2026')
  for (const locale of ['en', 'nl']) {
    for (const [from, to] of [
      ['2026-09-03', '2026-09-03'],
      ['2026-08-31', '2026-09-04'],
      ['2025-12-31', '2026-01-02']
    ]) {
      const formatter = new Intl.DateTimeFormat(locale, {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        timeZone: 'UTC'
      })
      assert.equal(
        formatTimesheetPeriod(from!, to!, locale),
        formatter.formatRange(new Date(`${from}T00:00:00Z`), new Date(`${to}T00:00:00Z`))
      )
    }
  }
})

test('email periods use the same locale and formatter as the UI', async () => {
  const h = harness([[person], [workspace], [{ id: 'r1', email: 'reviewer@example.com' }]])
  await h.notify({ ...submission, periodStartsOn: '2026-09-03', periodEndsOn: '2026-09-04' }, 'submitted')
  assert.equal(h.sent[0]!.locale, 'nl')
  assert.equal(h.sent[0]!.values.period!.replace(/\s/g, ' '), 'do 3 – vr 4 sep 2026')
  for (const definition of timesheetEmails) {
    for (const locale of ['en', 'nl'] as const) {
      assert.ok(definition.defaults[locale].subject.includes('{{period}}'))
      assert.ok(definition.defaults[locale].body.includes('{{period}}'))
    }
  }
})
