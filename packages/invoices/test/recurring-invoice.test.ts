import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import {
  addCalendarDays,
  dateInTimeZone,
  nextRecurrenceDate,
  recurringInvoiceSchema,
  renderPeriodText,
  type RecurringInvoiceInput
} from '../shared/recurring-invoice'

const template: RecurringInvoiceInput = {
  name: 'Hosting',
  enabled: true,
  period: 'monthly',
  startDate: '2026-12-01',
  endDate: null,
  timeZone: 'Europe/Amsterdam',
  locale: 'en',
  paymentTermDays: 30,
  clientOrganizationId: 'client',
  contactId: null,
  currency: 'EUR',
  subject: 'Hosting {{period}}',
  notes: 'From {{period_start}} to {{period_end}}',
  lines: [
    {
      description: 'Hosting {{month}} {{year}}',
      quantityMilli: 1000,
      unit: 'item',
      unitPriceMinor: 1000,
      vatRateBasisPoints: 2100
    }
  ]
}

test('calendar recurrence retains the original day across short months and leap years', () => {
  assert.equal(nextRecurrenceDate('2026-01-31', 'monthly', '2026-01-31'), '2026-02-28')
  assert.equal(nextRecurrenceDate('2026-01-31', 'monthly', '2026-02-28'), '2026-03-31')
  assert.equal(nextRecurrenceDate('2028-01-31', 'monthly', '2028-01-31'), '2028-02-29')
  assert.equal(nextRecurrenceDate('2028-02-29', 'yearly', '2028-02-29'), '2029-02-28')
  assert.equal(nextRecurrenceDate('2028-02-29', 'yearly', '2031-02-28'), '2032-02-29')
  assert.equal(nextRecurrenceDate('2026-08-31', 'quarterly', '2026-08-31'), '2026-11-30')
  assert.equal(nextRecurrenceDate('2026-08-31', 'quarterly', '2026-11-30'), '2027-02-28')
  assert.equal(nextRecurrenceDate('2026-08-31', 'quarterly', '2027-02-28'), '2027-05-31')
  assert.equal(nextRecurrenceDate('2026-12-31', 'daily', '2026-12-31'), '2027-01-01')
  assert.equal(nextRecurrenceDate('2026-12-28', 'weekly', '2026-12-28'), '2027-01-04')
  assert.equal(addCalendarDays('2026-12-01', 30), '2026-12-31')
})

test('placeholder rendering covers all invoice text fields in English and Dutch', () => {
  assert.equal(renderPeriodText(template.subject, template, '2026-12-01'), 'Hosting December 2026')
  assert.equal(renderPeriodText(template.notes, template, '2026-12-01'), 'From 2026-12-01 to 2026-12-31')
  assert.equal(renderPeriodText(template.lines[0]!.description, template, '2026-12-01'), 'Hosting December 2026')
  assert.equal(
    renderPeriodText('{{ period }} / {{period}}', { ...template, locale: 'nl' }, '2026-12-01'),
    'december 2026 / december 2026'
  )
  assert.equal(renderPeriodText(null, template, '2026-12-01'), null)
  assert.equal(renderPeriodText('{{period}}', { ...template, period: 'quarterly' }, '2026-12-01'), 'Q4 2026')
  assert.equal(renderPeriodText('{{period}}', { ...template, period: 'yearly' }, '2026-12-01'), '2026')
  assert.equal(renderPeriodText('{{period}}', { ...template, period: 'daily' }, '2026-12-01'), '2026-12-01')
  assert.equal(renderPeriodText('{{period_end}}', { ...template, startDate: '2026-01-31' }, '2026-02-28'), '2026-03-30')
})

test('weekly placeholders use the ISO week year at calendar year boundaries', () => {
  const weekly = { ...template, period: 'weekly' as const }
  assert.equal(renderPeriodText('{{period}}', weekly, '2026-12-21'), 'Week 52 2026')
  assert.equal(renderPeriodText('{{period}}', weekly, '2027-01-01'), 'Week 53 2026')
  assert.equal(renderPeriodText('{{week}} {{week_year}} / {{year}}', weekly, '2027-01-01'), '53 2026 / 2027')
  assert.equal(renderPeriodText('{{period}}', weekly, '2027-01-04'), 'Week 1 2027')
  assert.equal(renderPeriodText('{{period}}', weekly, '2025-12-29'), 'Week 1 2026')
  assert.equal(renderPeriodText('{{period}}', weekly, '2006-12-25'), 'Week 52 2006')
})

test('scheduled dates follow the selected timezone, including DST and UTC boundaries', () => {
  assert.equal(dateInTimeZone(new Date('2026-11-30T23:00:00Z'), 'Europe/Amsterdam'), '2026-12-01')
  assert.equal(dateInTimeZone(new Date('2026-12-01T00:00:00Z'), 'America/New_York'), '2026-11-30')
  assert.equal(dateInTimeZone(new Date('2026-03-29T22:00:00Z'), 'Europe/Amsterdam'), '2026-03-30')
  assert.equal(dateInTimeZone(new Date('2026-10-25T22:00:00Z'), 'Europe/Amsterdam'), '2026-10-25')
  assert.equal(nextRecurrenceDate('2026-03-23', 'weekly', '2026-03-23'), '2026-03-30')
})

test('previous-period placeholders support billing in arrears in every invoice text field', () => {
  const arrears = {
    ...template,
    startDate: '2026-11-01',
    subject: 'Hosting {{previous_period}}',
    notes: '{{previous_period_start}} to {{previous_period_end}}',
    lines: [{ ...template.lines[0]!, description: 'Hosting {{previous_month}} {{previous_year}}' }]
  }
  assert.equal(recurringInvoiceSchema.safeParse(arrears).success, true)
  assert.equal(renderPeriodText(arrears.subject, arrears, '2026-11-01'), 'Hosting October 2026')
  assert.equal(renderPeriodText(arrears.notes, arrears, '2026-11-01'), '2026-10-01 to 2026-10-31')
  assert.equal(renderPeriodText(arrears.lines[0]!.description, arrears, '2026-11-01'), 'Hosting October 2026')
  assert.equal(renderPeriodText('{{previous_period}}', { ...arrears, locale: 'nl' }, '2026-11-01'), 'oktober 2026')
  assert.equal(
    renderPeriodText('{{previous_period}} / {{period}}', arrears, '2027-01-01'),
    'December 2026 / January 2027'
  )
  assert.equal(renderPeriodText('{{previous_period}}', { ...arrears, period: 'quarterly' }, '2027-01-01'), 'Q4 2026')
  assert.equal(renderPeriodText('{{previous_period}}', { ...arrears, period: 'yearly' }, '2027-01-01'), '2026')
  assert.equal(renderPeriodText('{{previous_period}}', { ...arrears, period: 'daily' }, '2027-01-01'), '2026-12-31')
})

test('previous periods preserve anchored dates, leap years and ISO week years', () => {
  const dates = '{{previous_period_start}} to {{previous_period_end}}'
  assert.equal(
    renderPeriodText(dates, { ...template, startDate: '2026-01-31' }, '2026-03-31'),
    '2026-02-28 to 2026-03-30'
  )
  assert.equal(
    renderPeriodText(dates, { ...template, startDate: '2028-01-31' }, '2028-03-31'),
    '2028-02-29 to 2028-03-30'
  )
  assert.equal(
    renderPeriodText(dates, { ...template, period: 'yearly', startDate: '2028-02-29' }, '2029-02-28'),
    '2028-02-29 to 2029-02-27'
  )
  const weekly = { ...template, period: 'weekly' as const, startDate: '2027-01-04' }
  assert.equal(
    renderPeriodText('{{previous_period}} / {{previous_week}} {{previous_week_year}}', weekly, '2027-01-04'),
    'Week 53 2026 / 53 2026'
  )
  assert.equal(renderPeriodText(dates, weekly, '2027-01-04'), '2026-12-28 to 2027-01-03')
})

test('recurring template validation rejects invalid dates, placeholders, timezone and amounts', () => {
  assert.equal(recurringInvoiceSchema.safeParse(template).success, true)
  assert.equal(recurringInvoiceSchema.safeParse({ ...template, endDate: template.startDate }).success, true)
  for (const changes of [
    { startDate: '2026-02-30' },
    { startDate: '2026-13-01' },
    { startDate: '0099-01-01' },
    { endDate: '2026-11-30' },
    { timeZone: 'Nowhere/Invalid' },
    { paymentTermDays: -1 },
    { paymentTermDays: 1.5 },
    { period: 'sometimes' },
    { currency: 'eur' },
    { lines: [] },
    { subject: '{{unknown}}' },
    { notes: '{{period' },
    { notes: 'period}}' },
    { lines: [{ ...template.lines[0], description: '{{missing}}' }] },
    { lines: [{ ...template.lines[0], unitPriceMinor: -1 }] }
  ]) {
    assert.equal(recurringInvoiceSchema.safeParse({ ...template, ...changes }).success, false, JSON.stringify(changes))
  }
})

test('recurring UI uses validated Nuxt forms, shared lists and conditionally mounted editors', () => {
  const form = readFileSync(new URL('../app/components/InvoicesRecurringForm.vue', import.meta.url), 'utf8')
  const page = readFileSync(new URL('../app/pages/admin/invoices/recurring.vue', import.meta.url), 'utf8')
  assert.match(form, /<UForm\s+ref="form"\s+:schema="schema"/)
  assert.match(form, /recurringInvoiceSchema\['~standard'\]\.validate/)
  assert.match(form, /novalidate/)
  assert.match(form, /InvoicesInvoiceLinesEditor/)
  assert.match(page, /InvoicesAdminListToolbar/)
  assert.match(page, /InvoicesAdminPaginatedList/)
  assert.match(page, /v-if="editing === schedule.id"/)
  assert.match(page, /@click.stop="toggleEdit/)
})

test('recurring form avoids empty select options and inverted informational surfaces', () => {
  const form = readFileSync(new URL('../app/components/InvoicesRecurringForm.vue', import.meta.url), 'utf8')
  assert.match(form, /noContact'\), value: 'none'/)
  assert.match(form, /get: \(\) => state.contactId \?\? 'none'/)
  assert.match(form, /state.contactId = value === 'none' \? null : value/)
  assert.match(form, /v-if="client && client.clientType !== 'person'"/)
  assert.doesNotMatch(form, /value: ''/)
  for (const alert of form.matchAll(/<UAlert\b[^>]*color="neutral"[^>]*>/g)) {
    assert.match(alert[0], /variant="subtle"/)
  }
  assert.match(form, /container\.scrollTo\(/)
  assert.match(form, /@error="focusErrors\(\$event.errors\)"/)
  assert.match(form, /querySelector<HTMLElement>\('\[aria-invalid="true"\]'\)/)
  assert.doesNotMatch(form, /root\.value\.scrollIntoView/)
})

test('recurring invoice navigation uses the same management capability as sales invoices', () => {
  const plugin = readFileSync(new URL('../app/plugins/invoices-feature.ts', import.meta.url), 'utf8')
  assert.match(
    plugin,
    /item\.id === 'sales-invoices' \|\| item\.id === 'recurring-invoices'\s*\? capabilities\.canManageInvoices/
  )
})
