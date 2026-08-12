import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import test from 'node:test'
import en from '../i18n/locales/en.json' with { type: 'json' }
import nl from '../i18n/locales/nl.json' with { type: 'json' }
import { timesheetsFeature } from '../shared/feature'
import { clientAccessUpdateSchema, entryCreateSchema, organizationCapabilitiesUpdateSchema, reviewSchema, settingsUpdateSchema } from '../server/utils/timesheet-validation'
import { mondayFor } from '../shared/timesheet-dates'

const objectKeys = (value: unknown, prefix = ''): string[] => !value || typeof value !== 'object' || Array.isArray(value) ? [prefix] : Object.entries(value).flatMap(([key, child]) => objectKeys(child, prefix ? `${prefix}.${key}` : key))

test('English and Dutch expose identical feature locale keys', () => assert.deepEqual(objectKeys(en).sort(), objectKeys(nl).sort()))

test('Timesheets owns only Timesheets navigation and dashboards', () => {
  const serialized = JSON.stringify(timesheetsFeature)
  assert.doesNotMatch(serialized, /invoice/i)
  assert.equal(timesheetsFeature.modules?.length, 1)
  assert.deepEqual(timesheetsFeature.dashboardWidgets?.map(widget => widget.id), ['timesheets-my-week', 'timesheets-internal-approvals', 'timesheets-client-approvals', 'timesheets-supplier-timesheets'])
})

test('Timesheets source contains no invoice routes, APIs, or schema exports', () => {
  const roots = ['app/pages', 'server/api']
  for (const root of roots) {
    const walk = (path: URL): string[] => readdirSync(path, { withFileTypes: true }).flatMap(item => item.isDirectory() ? walk(new URL(`${item.name}/`, path)) : [new URL(item.name, path).pathname])
    assert.equal(walk(new URL(`../${root}/`, import.meta.url)).some(path => path.toLowerCase().includes('invoice')), false)
  }
  const schema = readFileSync(new URL('../server/db/schema/timesheets.ts', import.meta.url), 'utf8')
  assert.doesNotMatch(schema, /export const invoice|invoiceAccessEnabled|invoicingEnabled|organizationInvoice/)
})

test('workspace and access validation is invoice-independent', () => {
  assert.deepEqual(organizationCapabilitiesUpdateSchema.parse({ workspaceEnabled: true }), { workspaceEnabled: true })
  assert.deepEqual(organizationCapabilitiesUpdateSchema.parse({ workspaceEnabled: true, invoicingEnabled: true }), { workspaceEnabled: true })
  assert.equal(clientAccessUpdateSchema.safeParse({ accessMode: 'REVIEW' }).success, true)
})

test('entry, review, settings, and week boundaries remain valid', () => {
  assert.equal(entryCreateSchema.safeParse({ projectId: 'p', activityTypeId: 'a', entryDate: '2026-08-12', durationMinutes: 30 }).success, true)
  assert.equal(reviewSchema.safeParse({ action: 'REJECT' }).success, false)
  assert.equal(settingsUpdateSchema.parse({ currency: 'eur' }).currency, 'EUR')
  assert.equal(mondayFor('2026-08-12'), '2026-08-10')
})
