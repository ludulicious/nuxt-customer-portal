import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { runInNewContext } from 'node:vm'
import test from 'node:test'
import ts from 'typescript'
import { timesheetEmails } from '../shared/emails'
import { formatTimesheetPeriod } from '../shared/timesheet-dates'

const require = createRequire(import.meta.url)
const code = ts.transpileModule(
  readFileSync(new URL('../server/utils/client-review-request-email.ts', import.meta.url), 'utf8'),
  {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
  }
).outputText
const harness = (failFirst = false) => {
  const exports = {} as typeof import('../server/utils/client-review-request-email')
  const sends: Array<{
    to: string
    locale: string
    values: Record<string, string>
    idempotencyKey: string
    definition: { id: string }
  }> = []
  const errors: unknown[] = []
  runInNewContext(code, {
    exports,
    URL,
    process: { env: { BETTER_AUTH_URL: 'http://localhost:4191' } },
    console: { error: (...args: unknown[]) => errors.push(args) },
    require: (id: string) => {
      if (id.endsWith('/server/portal')) {
        return { db: {} }
      }
      if (id.endsWith('/portal-email')) {
        return {
          getPortalEmailSettings: async () => ({ defaultLocale: 'en' }),
          sendPortalEmail: async (input: (typeof sends)[number]) => {
            sends.push(input)
            if (failFirst && sends.length === 1) {
              throw new Error('Delivery unavailable')
            }
          }
        }
      }
      if (id.endsWith('/client-email-locale')) {
        return { getClientEmailLocale: async () => 'nl' }
      }
      if (id === '../../shared/emails') {
        return { timesheetEmails }
      }
      if (id === '../../shared/timesheet-dates') {
        return { formatTimesheetPeriod }
      }
      if (id === './client-review-requests') {
        return {
          eligibleReviewers: async () => [{ id: 'reviewer', name: '<Reviewer>', email: 'reviewer@example.test' }],
          reviewRows: async (_db: unknown, query: { queryChunks: unknown[] }) => {
            const rendered = JSON.stringify(query.queryChunks)
            return rendered.includes('workspace_client_id')
              ? [
                  {
                    linkId: 'link',
                    workspaceId: 'workspace',
                    clientId: 'client',
                    clientName: 'Client & Co',
                    supplierName: 'Supplier',
                    startsOn: '2026-10-01',
                    endsOn: '2026-10-31',
                    version: 2,
                    comment: '<script>text</script>'
                  }
                ]
              : [
                  { id: 'provider', name: 'Provider', email: 'provider@example.test' },
                  { id: 'member', name: 'Member', email: 'member@example.test' }
                ]
          }
        }
      }
      return require(id)
    }
  })
  return { notify: exports.notifyReviewRequest, sends, errors }
}

test('sending a combined request emails eligible reviewers in the client language with escaped values and period link', async () => {
  const h = harness()
  await h.notify('request', 'SENT')
  assert.equal(h.sends.length, 1)
  assert.equal(h.sends[0]!.to, 'reviewer@example.test')
  assert.equal(h.sends[0]!.locale, 'nl')
  assert.equal(h.sends[0]!.definition.id, 'period-requested')
  assert.equal(h.sends[0]!.values.recipient_name, '&lt;Reviewer&gt;')
  assert.equal(h.sends[0]!.values.comment, '&lt;script&gt;text&lt;/script&gt;')
  assert.equal(h.sends[0]!.values.action_url, 'http://localhost:4191/timesheets/approvals?request=request')
})
test('decisions notify provider administrators and affected members while withdrawals also notify reviewers', async () => {
  const h = harness()
  await h.notify('request', 'APPROVED')
  assert.deepEqual(
    h.sends.map((s) => s.to),
    ['provider@example.test', 'member@example.test']
  )
  assert.ok(h.sends.every((s) => s.locale === 'en' && s.definition.id === 'period-approved'))
  const withdrawal = harness()
  await withdrawal.notify('request', 'WITHDRAWN')
  assert.equal(withdrawal.sends.length, 3)
  assert.equal(new Set(withdrawal.sends.map((s) => s.idempotencyKey)).size, 3)
})
test('notification delivery failure does not reject a committed action or prevent other recipients', async () => {
  const h = harness(true)
  await h.notify('request', 'DISPUTED')
  assert.equal(h.sends.length, 2)
  assert.equal(h.errors.length, 1)
})
