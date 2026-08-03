import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import test from 'node:test'
import en from '../i18n/locales/en.json' with { type: 'json' }
import nl from '../i18n/locales/nl.json' with { type: 'json' }
import { timesheetsFeature } from '../shared/feature'
import {
  activityDeleteSchema,
  activityListQuerySchema,
  clientCreateSchema,
  clientDeleteSchema,
  clientListQuerySchema,
  contactCreateSchema,
  entryCreateSchema,
  hasInvalidProjectActivityAssignments,
  invoiceCreateSchema,
  invoiceEmailDeliverySchema,
  invoiceIssueSchema,
  invoiceListQuerySchema,
  invoicePaymentSchema,
  organizationProfileUpdateSchema,
  projectCreateSchema,
  projectListQuerySchema,
  reviewSchema,
  settingsUpdateSchema
} from '../server/utils/timesheet-validation'
import { invoiceOverdueDetails, mondayFor } from '../shared/timesheet-dates'
import { isKnownEmailProviderEvent, normalizeEmailProviderEvent } from '../shared/email-delivery-status'
import { DEFAULT_INVOICE_EMAIL_TEMPLATE, renderInvoiceEmailTemplate } from '../shared/invoice-email-template'

const objectKeys = (value: unknown, prefix = ''): string[] => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return [prefix]
  return Object.entries(value).flatMap(([key, child]) =>
    objectKeys(child, prefix ? `${prefix}.${key}` : key))
}

test('English and Dutch expose identical feature locale keys', () => {
  assert.deepEqual(objectKeys(en).sort(), objectKeys(nl).sort())
})

test('feature policy reserves management and approval for admins', () => {
  assert.equal(timesheetsFeature.policy.member.includes('manage'), false)
  assert.equal(timesheetsFeature.policy.member.includes('approve'), false)
  assert.equal(timesheetsFeature.policy.member.includes('submit'), true)
})

test('admin list queries share bounded pagination and entity-specific filters', () => {
  assert.deepEqual(projectListQuerySchema.parse({}), { page: 1, pageSize: 20, sortDir: 'asc', sortBy: 'name' })
  assert.equal(projectListQuerySchema.parse({ clientOrganizationId: 'client', sortBy: 'clientName' }).clientOrganizationId, 'client')
  assert.equal(clientListQuerySchema.parse({ configured: 'incomplete' }).configured, 'incomplete')
  assert.equal(activityListQuerySchema.parse({ active: 'false', billable: 'true' }).active, 'false')
  assert.deepEqual(invoiceListQuerySchema.parse({ status: 'ISSUED' }), { page: 1, pageSize: 20, sortDir: 'desc', sortBy: 'issueDate', status: 'ISSUED' })
  assert.equal(invoiceListQuerySchema.safeParse({ pageSize: 101 }).success, false)
})

test('week boundaries normalize to Monday', () => {
  assert.equal(mondayFor('2026-07-30'), '2026-07-27')
  assert.equal(mondayFor('2026-08-02'), '2026-07-27')
  assert.equal(mondayFor('2026-08-03'), '2026-08-03')
})

test('entry input requires positive minute precision', () => {
  assert.equal(entryCreateSchema.safeParse({
    projectId: 'project',
    activityTypeId: 'activity',
    entryDate: '2026-07-30',
    durationMinutes: 1
  }).success, true)
  assert.equal(entryCreateSchema.safeParse({
    projectId: 'project',
    activityTypeId: 'activity',
    entryDate: '2026-07-30',
    durationMinutes: 0
  }).success, false)
})

test('project dates and activity assignments are validated', () => {
  assert.equal(projectCreateSchema.safeParse({
    clientOrganizationId: 'client',
    name: 'Project',
    startsOn: '2026-08-02',
    endsOn: '2026-08-01',
    activityTypeIds: ['activity']
  }).success, false)
  assert.equal(projectCreateSchema.safeParse({
    clientOrganizationId: 'client',
    name: 'Project',
    activityTypeIds: []
  }).success, false)
})

test('project updates retain linked inactive activities without allowing new inactive assignments', () => {
  const activities = [
    { id: 'active', active: true },
    { id: 'inactive', active: false }
  ]
  assert.equal(hasInvalidProjectActivityAssignments(
    ['active', 'inactive'],
    activities,
    ['inactive']
  ), false)
  assert.equal(hasInvalidProjectActivityAssignments(
    ['inactive'],
    activities
  ), true)
})

test('activity deletion requires an exact non-empty confirmation name', () => {
  assert.equal(activityDeleteSchema.safeParse({ activityName: 'Development' }).success, true)
  assert.equal(activityDeleteSchema.safeParse({ activityName: '' }).success, false)
  assert.equal(activityDeleteSchema.safeParse({}).success, false)
})

test('client links require an organization and deletion requires an exact non-empty name', () => {
  assert.equal(clientCreateSchema.safeParse({ organizationId: 'organization' }).success, true)
  assert.equal(clientCreateSchema.safeParse({ mode: 'create', name: 'Client', slug: 'client' }).success, false)
  assert.equal(clientDeleteSchema.safeParse({ clientName: 'Acme' }).success, true)
  assert.equal(clientDeleteSchema.safeParse({ clientName: '' }).success, false)
})

test('contact emails are validated and normalized', () => {
  assert.equal(contactCreateSchema.safeParse({ name: 'Contact', email: 'invalid' }).success, false)
  const result = contactCreateSchema.parse({ name: 'Contact', email: ' Contact@Example.COM ' })
  assert.equal(result.email, 'contact@example.com')
})

test('rejection requires a comment and currency is normalized', () => {
  assert.equal(reviewSchema.safeParse({ action: 'REJECT' }).success, false)
  assert.equal(reviewSchema.safeParse({ action: 'REJECT', comment: 'Add the missing Friday.' }).success, true)
  assert.equal(settingsUpdateSchema.parse({ currency: 'eur' }).currency, 'EUR')
  assert.equal(settingsUpdateSchema.parse({ defaultVatRateBasisPoints: 0 }).defaultVatRateBasisPoints, 0)
  assert.equal(settingsUpdateSchema.safeParse({ defaultVatRateBasisPoints: 10_001 }).success, false)
})

test('invoices require dated recipient snapshots, valid lines, and positive payments', () => {
  const valid = {
    clientOrganizationId: 'client',
    number: '2026-001', currency: 'EUR', issueDate: '2026-07-31', dueDate: '2026-08-30',
    lines: [{ description: 'Consulting', quantityMilli: 8000, unit: 'hour', unitPriceMinor: 10000, vatRateBasisPoints: 2100 }]
  }
  assert.equal(invoiceCreateSchema.safeParse(valid).success, true)
  assert.equal(invoiceCreateSchema.safeParse({ ...valid, dueDate: '2026-07-30' }).success, false)
  assert.equal(invoiceCreateSchema.safeParse({ ...valid, lines: [] }).success, false)
  assert.equal(invoicePaymentSchema.safeParse({ paidOn: '2026-08-01', amountMinor: 1 }).success, true)
  assert.equal(invoicePaymentSchema.safeParse({ paidOn: '2026-08-01', amountMinor: 0 }).success, false)
})

test('invoice overdue state starts after the due date and requires an issued balance', () => {
  const now = new Date('2026-08-02T10:00:00Z')
  assert.deepEqual(invoiceOverdueDetails('2026-08-01', 'ISSUED', 100, 'Europe/Amsterdam', now), { isOverdue: true, daysOverdue: 1 })
  assert.deepEqual(invoiceOverdueDetails('2026-08-02', 'ISSUED', 100, 'Europe/Amsterdam', now), { isOverdue: false, daysOverdue: 0 })
  assert.deepEqual(invoiceOverdueDetails('2026-08-01', 'DRAFT', 100, 'Europe/Amsterdam', now), { isOverdue: false, daysOverdue: 0 })
  assert.deepEqual(invoiceOverdueDetails('2026-08-01', 'PAID', 0, 'Europe/Amsterdam', now), { isOverdue: false, daysOverdue: 0 })
  assert.deepEqual(invoiceOverdueDetails('2026-08-01', 'VOID', 100, 'Europe/Amsterdam', now), { isOverdue: false, daysOverdue: 0 })
})

test('invoice status actions support voiding and unvoiding', () => {
  assert.equal(invoiceIssueSchema.safeParse({ action: 'VOID' }).success, true)
  assert.equal(invoiceIssueSchema.safeParse({ action: 'UNVOID' }).success, true)
  assert.equal(invoiceIssueSchema.safeParse({ action: 'DELETE' }).success, false)
})

test('invoice email delivery validates and normalizes recipients', () => {
  const result = invoiceEmailDeliverySchema.parse({
    to: ' Billing@Example.com ',
    cc: ['copy@example.com', 'COPY@example.com', 'billing@example.com'],
    locale: 'nl',
    subject: 'Factuur 1',
    body: 'Bijgaand de factuur.'
  })
  assert.deepEqual(result, {
    to: 'billing@example.com', cc: ['copy@example.com'], locale: 'nl', subject: 'Factuur 1', body: 'Bijgaand de factuur.'
  })
  assert.equal(invoiceEmailDeliverySchema.safeParse({ to: 'invalid', cc: [], locale: 'en', subject: 'Invoice', body: 'Attached.' }).success, false)
})

test('client invoice profiles accept supported preferred languages only', () => {
  const base = { address: 'Main Street 1', invoiceEmail: 'billing@example.com' }
  assert.equal(organizationProfileUpdateSchema.safeParse({ ...base, preferredLocale: 'en' }).success, true)
  assert.equal(organizationProfileUpdateSchema.safeParse({ ...base, preferredLocale: 'de' }).success, false)
  assert.equal(organizationProfileUpdateSchema.safeParse({ ...base, invoiceEmailTemplate: '<p>No body</p>' }).success, false)
  assert.equal(organizationProfileUpdateSchema.safeParse({ ...base, invoiceEmailTemplate: '<main>{{body}}</main>' }).success, true)
})

test('organization invoice email templates render escaped invoice values and retain the default', () => {
  const values = {
    body: 'Hello <client>', subject: 'Invoice & details', invoiceNumber: '2026-001',
    senderName: 'Sender', recipientName: 'Client', logoUrl: 'https://example.com/logo.png?a=1&b=2'
  }
  assert.equal(renderInvoiceEmailTemplate(null, values), DEFAULT_INVOICE_EMAIL_TEMPLATE.replace('{{body}}', 'Hello &lt;client&gt;'))
  assert.equal(
    renderInvoiceEmailTemplate('<h1>{{subject}}</h1><p>{{body}}</p><img src="{{logo_url}}">', values),
    '<h1>Invoice &amp; details</h1><p>Hello &lt;client&gt;</p><img src="https://example.com/logo.png?a=1&amp;b=2">'
  )
})

test('Resend delivery events are normalized while future events remain supported', () => {
  assert.equal(normalizeEmailProviderEvent('email.delivery-delayed'), 'delivery_delayed')
  assert.equal(normalizeEmailProviderEvent('OPENED'), 'opened')
  assert.equal(isKnownEmailProviderEvent('opened'), true)
  assert.equal(isKnownEmailProviderEvent('future_event'), false)
})

test('all literal translation references exist in both locales', () => {
  const keys = new Set(objectKeys(en))
  const files = sourceFiles(new URL('../app/', import.meta.url))
  for (const file of files) {
    const source = readFileSync(file, 'utf8')
    const references = [
      ...source.matchAll(/(?<![\w$])(?:\$t|t)\(\s*['"]([^'"`]+)['"]/g),
      ...source.matchAll(/labelKey\s*:\s*['"]([^'"]+)['"]/g)
    ].map(match => match[1])
    for (const key of references) {
      assert.equal(keys.has(key), true, `${file.pathname} references missing locale key ${key}`)
    }
  }
})

function sourceFiles(directory: URL): URL[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const url = new URL(entry.name, directory)
    if (entry.isDirectory()) return sourceFiles(new URL(`${entry.name}/`, directory))
    return /\.(?:ts|vue)$/.test(entry.name) ? [url] : []
  })
}
