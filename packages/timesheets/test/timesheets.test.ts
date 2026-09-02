import assert from 'node:assert/strict'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import test from 'node:test'
import en from '../i18n/locales/en.json' with { type: 'json' }
import nl from '../i18n/locales/nl.json' with { type: 'json' }
import { timesheetsFeature } from '../shared/feature'
import {
  clientAccessUpdateSchema,
  entryCreateSchema,
  organizationCapabilitiesUpdateSchema,
  reviewSchema,
  settingsUpdateSchema
} from '../server/utils/timesheet-validation'
import { mondayFor } from '../shared/timesheet-dates'

const objectKeys = (value: unknown, prefix = ''): string[] =>
  !value || typeof value !== 'object' || Array.isArray(value)
    ? [prefix]
    : Object.entries(value).flatMap(([key, child]) => objectKeys(child, prefix ? `${prefix}.${key}` : key))

test('English and Dutch expose identical feature locale keys', () =>
  assert.deepEqual(objectKeys(en).sort(), objectKeys(nl).sort()))

test('every Timesheets admin section has a translated subtitle', () => {
  const sections = ['approvals', 'projects', 'activities', 'rates', 'settings', 'reports'] as const
  for (const section of sections) {
    assert.ok(en.features.timesheets.admin.sectionSubtitles[section])
    assert.ok(nl.features.timesheets.admin.sectionSubtitles[section])
  }
})

test('every organization role shown by Timesheets has a translation', () => {
  const roles = ['owner', 'admin', 'member'] as const
  for (const role of roles) {
    assert.ok(en.features.timesheets.roles[role])
    assert.ok(nl.features.timesheets.roles[role])
  }
})

test('internal projects use the provider organization without creating a client link', () => {
  const repository = readFileSync(new URL('../server/utils/timesheet-repository.ts', import.meta.url), 'utf8')
  const form = readFileSync(new URL('../app/components/TimesheetsProjectForm.vue', import.meta.url), 'utf8')
  const bootstrap = readFileSync(new URL('../server/api/timesheets/admin/bootstrap.get.ts', import.meta.url), 'utf8')

  assert.match(repository, /clientOrganizationId === organizationId/)
  assert.match(repository, /internal: item\.clientOrganizationId === organizationId/)
  assert.match(repository, /clients\.length > 0 \|\| activeProjects\.some\(\(item\) => item\.internal\)/)
  assert.match(form, /providerOrganization\.organizationId/)
  assert.match(bootstrap, /providerOrganization/)
  assert.equal(en.features.timesheets.admin.internalOrganization, '{name} — Internal')
  assert.equal(nl.features.timesheets.admin.internalOrganization, '{name} — Intern')
})

test('provider workspace capabilities cannot leak into client organizations', () => {
  const capabilities = readFileSync(new URL('../server/api/timesheets/capabilities.get.ts', import.meta.url), 'utf8')
  const repository = readFileSync(new URL('../server/utils/timesheet-repository.ts', import.meta.url), 'utf8')
  const pageShell = readFileSync(new URL('../app/components/TimesheetsPageShell.vue', import.meta.url), 'utf8')
  const timesheetPage = readFileSync(new URL('../app/pages/timesheets/index.vue', import.meta.url), 'utf8')
  const capabilityUpdate = readFileSync(
    new URL('../server/api/timesheets/admin/organization-capabilities/[organizationId].patch.ts', import.meta.url),
    'utf8'
  )

  assert.match(capabilities, /organizationType === 'PROVIDER'.*workspaceEnabled/)
  assert.match(repository, /organizationType !== 'PROVIDER'/)
  assert.match(pageShell, /activeOrganizationType === 'PROVIDER'/)
  assert.match(timesheetPage, /if \(capabilities\.canEnterTime\)\s*\{?\s*return/)
  assert.match(timesheetPage, /capabilities\.canReviewClientTimesheets[\s\S]*\/timesheets\/approvals/)
  assert.match(capabilityUpdate, /organizationType !== 'PROVIDER' && input\.workspaceEnabled/)
})

test('Timesheets owns only Timesheets navigation and dashboards', () => {
  const serialized = JSON.stringify(timesheetsFeature)
  assert.doesNotMatch(serialized, /invoice/i)
  assert.equal(timesheetsFeature.modules?.length, 1)
  assert.deepEqual(
    timesheetsFeature.dashboardWidgets?.map((widget) => widget.id),
    [
      'timesheets-my-week',
      'timesheets-internal-approvals',
      'timesheets-client-approvals',
      'timesheets-supplier-timesheets'
    ]
  )
})

test('Timesheets source contains no invoice routes, APIs, or schema exports', () => {
  const roots = ['app/pages', 'server/api']
  for (const root of roots) {
    const walk = (path: URL): string[] =>
      readdirSync(path, { withFileTypes: true }).flatMap((item) =>
        item.isDirectory() ? walk(new URL(`${item.name}/`, path)) : [new URL(item.name, path).pathname]
      )
    assert.equal(
      walk(new URL(`../${root}/`, import.meta.url)).some((path) => path.toLowerCase().includes('invoice')),
      false
    )
  }
  const schema = readFileSync(new URL('../server/db/schema/timesheets.ts', import.meta.url), 'utf8')
  assert.doesNotMatch(schema, /export const invoice|invoiceAccessEnabled|invoicingEnabled|organizationInvoice/)
})

test('client management uses the canonical Clients module', () => {
  const checklist = readFileSync(new URL('../app/components/TimesheetsSetupChecklist.vue', import.meta.url), 'utf8')
  const projectForm = readFileSync(new URL('../app/components/TimesheetsProjectForm.vue', import.meta.url), 'utf8')
  const menu = readFileSync(new URL('../app/composables/useTimesheetMenu.ts', import.meta.url), 'utf8')

  assert.match(checklist, /key: 'client', to: '\/clients'/)
  assert.match(projectForm, /to="\/clients"/)
  assert.doesNotMatch(`${checklist}\n${projectForm}\n${menu}`, /\/admin\/timesheets\/clients/)
  assert.equal(existsSync(new URL('../app/pages/admin/timesheets/clients.vue', import.meta.url)), false)
})

test('workspace and access validation is invoice-independent', () => {
  assert.deepEqual(organizationCapabilitiesUpdateSchema.parse({ workspaceEnabled: true }), { workspaceEnabled: true })
  assert.deepEqual(organizationCapabilitiesUpdateSchema.parse({ workspaceEnabled: true, invoicingEnabled: true }), {
    workspaceEnabled: true
  })
  assert.equal(clientAccessUpdateSchema.safeParse({ accessMode: 'REVIEW' }).success, true)
})

test('entry, review, settings, and week boundaries remain valid', () => {
  assert.equal(
    entryCreateSchema.safeParse({ projectId: 'p', activityTypeId: 'a', entryDate: '2026-08-12', durationMinutes: 30 })
      .success,
    true
  )
  assert.equal(reviewSchema.safeParse({ action: 'REJECT' }).success, false)
  assert.equal(settingsUpdateSchema.parse({ currency: 'eur' }).currency, 'EUR')
  assert.equal(mondayFor('2026-08-12'), '2026-08-10')
})
