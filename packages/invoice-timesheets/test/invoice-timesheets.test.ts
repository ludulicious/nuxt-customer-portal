import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { timesheetInvoiceCreateSchema } from '../shared/validation'

test('bridge validates source-backed lines', () => {
  const input = {
    clientOrganizationId: 'client',
    number: '2026.0001',
    currency: 'EUR',
    issueDate: '2026-08-12',
    dueDate: '2026-09-11',
    lines: [
      {
        description: 'Approved time',
        quantityMilli: 1000,
        unit: 'hour',
        unitPriceMinor: 10000,
        vatRateBasisPoints: 2100,
        timeEntryIds: ['entry']
      }
    ]
  }
  assert.equal(timesheetInvoiceCreateSchema.safeParse(input).success, true)
  assert.equal(
    timesheetInvoiceCreateSchema.safeParse({ ...input, lines: [{ ...input.lines[0], timeEntryIds: [] }] }).success,
    false
  )
})

test('bridge owns only canonical integration endpoints and concurrency protection', () => {
  const source = readFileSync(new URL('../server/utils/invoice-timesheets.ts', import.meta.url), 'utf8')
  assert.match(source, /pg_advisory_xact_lock/)
  assert.match(source, /DRAFT.*ISSUED.*PAID/)
  assert.match(source, /DISPUTED/)
  assert.match(source, /requireTimesheetWorkspace/)
  assert.match(source, /item\.clientOrganizationId === organizationId/)
  assert.match(source, /input\.clientOrganizationId === organizationId/)
  assert.match(source, /Internal time entries cannot be invoiced/)
})
