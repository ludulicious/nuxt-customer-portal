import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { invoicesFeature } from '../shared/feature'
import {
  billingContactCreateSchema,
  invoiceCreateSchema,
  invoiceEmailDeliverySchema,
  invoiceIssueSchema,
  invoiceSettingsSchema
} from '../server/utils/invoice-validation'
import { firstInvoiceNumber, incrementInvoiceNumber } from '../shared/invoice-number'

test('invoice creation has a dedicated route and a non-shrinking scrollable form', () => {
  const page = readFileSync(new URL('../app/pages/admin/invoices/new.vue', import.meta.url), 'utf8')
  const component = readFileSync(new URL('../app/components/InvoicesAdminInvoices.vue', import.meta.url), 'utf8')
  const toolbar = readFileSync(new URL('../../ui/app/components/PortalListToolbar.vue', import.meta.url), 'utf8')
  assert.match(page, /create-page/)
  assert.match(component, /navigateTo\('\/admin\/invoices\/new'\)/)
  assert.match(component, /v-if="!createPage"/)
  assert.match(component, /formOpen \? 'overflow-y-auto py-1'/)
  assert.match(component, /v-if="formOpen" class="shrink-0 scroll-mt-6"/)
  assert.match(toolbar, /useElementSize\(toolbar\)/)
  assert.match(toolbar, /v-model:open="showFilters"/)
})

test('client general email is not required or used as an invoice recipient fallback', () => {
  const repository = readFileSync(new URL('../server/utils/invoice-repository.ts', import.meta.url), 'utf8')
  const form = readFileSync(new URL('../app/components/InvoicesAdminInvoices.vue', import.meta.url), 'utf8')
  assert.match(repository, /recipientEmail: contact\?\.email \?\? null/)
  assert.doesNotMatch(form, /!client\.invoiceEmail/)
})

test('provider invoice access overview is scoped and read-only', () => {
  const repository = readFileSync(new URL('../server/utils/invoice-repository.ts', import.meta.url), 'utf8')
  const overview = repository
    .split('export const getClientInvoiceAccessOverview =')[1]!
    .split('export const listClientInvoiceViewers')[0]!
  assert.match(overview, /eq\(invoiceClientAccess.providerOrganizationId, providerOrganizationId\)/)
  assert.match(overview, /eq\(invoiceClientAccess.clientOrganizationId, clientOrganizationId\)/)
  assert.match(overview, /\['owner', 'admin'\].includes\(member.role\)/)
  assert.match(overview, /item.userId === member.userId/)
  assert.match(overview, /canView: moduleEnabled && Boolean\(access\?\.enabled\) && assigned/)
  assert.doesNotMatch(overview, /\.insert\(|\.update\(|\.delete\(|ensureClientAccess/)
  const route = readFileSync(
    new URL('../server/api/invoices/admin/clients/[clientId]/access.get.ts', import.meta.url),
    'utf8'
  )
  assert.match(route, /organizationType !== 'PROVIDER'/)
  const en = JSON.parse(readFileSync(new URL('../i18n/locales/en.json', import.meta.url), 'utf8'))
  const nl = JSON.parse(readFileSync(new URL('../i18n/locales/nl.json', import.meta.url), 'utf8'))
  assert.deepEqual(
    Object.keys(en.features.invoices.clientAccess).sort(),
    Object.keys(nl.features.invoices.clientAccess).sort()
  )
})

test('Invoices exposes canonical routes independently', () => {
  const serialized = JSON.stringify(invoicesFeature)
  assert.match(serialized, /\/invoices/)
  assert.match(serialized, /\/admin\/invoices/)
  assert.doesNotMatch(serialized, /timesheets/i)
  assert.equal(invoicesFeature.clientIntegration?.detailComponent, 'InvoicesClientSettingsPanel')
})

test('free-form invoice and lifecycle inputs validate', () => {
  const input = {
    clientOrganizationId: 'client',
    number: '2026.0001',
    currency: 'EUR',
    issueDate: '2026-08-12',
    dueDate: '2026-09-11',
    lines: [
      { description: 'Consulting', quantityMilli: 1000, unit: 'hour', unitPriceMinor: 10000, vatRateBasisPoints: 2100 }
    ]
  }
  assert.equal(invoiceCreateSchema.safeParse(input).success, true)
  assert.equal(invoiceCreateSchema.safeParse({ ...input, dueDate: '2026-08-11' }).success, false)
  assert.equal(invoiceIssueSchema.safeParse({ action: 'VOID' }).success, true)
  assert.equal(invoiceIssueSchema.safeParse({ action: 'UNVOID' }).success, true)
})

test('settings, billing contacts, email, and numbering validate', () => {
  assert.equal(
    invoiceSettingsSchema.safeParse({
      enabled: true,
      currency: 'eur',
      defaultVatRateBasisPoints: 2100,
      address: '',
      registrationNumber: null,
      vatNumber: null,
      iban: null,
      bic: null,
      invoiceEmail: null,
      preferredLocale: 'nl'
    }).success,
    true
  )
  assert.equal(
    billingContactCreateSchema.parse({ name: 'Billing', email: ' Billing@Example.com ' }).email,
    'billing@example.com'
  )
  assert.equal(
    invoiceEmailDeliverySchema.safeParse({
      to: 'billing@example.com',
      cc: [],
      locale: 'en',
      subject: 'Invoice',
      body: 'Attached.'
    }).success,
    true
  )
  assert.equal(firstInvoiceNumber(2026), '2026.0001')
  assert.equal(incrementInvoiceNumber('INV-999'), 'INV-1000')
  assert.equal(incrementInvoiceNumber('INV-999999999999999999999999'), 'INV-1000000000000000000000000')
})

test('legacy Timesheets invoice routes are absent and migration verifies copied ids', () => {
  const migration = readFileSync(new URL('../migrations/0000_baseline.sql', import.meta.url), 'utf8')
  const bridgeMigration = readFileSync(
    new URL('../../invoice-timesheets/migrations/0000_baseline.sql', import.meta.url),
    'utf8'
  )
  assert.match(migration, /INSERT INTO invoices\.invoice/)
  assert.match(migration, /EXCEPT SELECT id FROM invoices\.invoice/)
  assert.match(migration, /DROP TABLE timesheets\.invoice/)
  assert.match(bridgeMigration, /invoices\._legacy_timesheet_source/)
})
