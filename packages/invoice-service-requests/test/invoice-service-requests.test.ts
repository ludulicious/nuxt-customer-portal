import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { serviceRequestInvoiceCreateSchema } from '../shared/validation'

test('service-request invoice input requires canonical invoice fields', () => {
  const input = { requestId: 'request', quoteId: 'quote', clientOrganizationId: 'client', number: '2026-001', currency: 'EUR', issueDate: '2026-08-26', dueDate: '2026-09-25', lines: [{ description: 'Work', quantityMilli: 1000, unit: 'item', unitPriceMinor: 10000, vatRateBasisPoints: 2100 }] }
  assert.equal(serviceRequestInvoiceCreateSchema.safeParse(input).success, true)
  assert.equal(serviceRequestInvoiceCreateSchema.safeParse({ ...input, dueDate: '2026-08-01' }).success, false)
})

test('bridge locks conversion, reloads accepted lines, and enforces one invoice', () => {
  const source = readFileSync(new URL('../server/utils/invoice-service-requests.ts', import.meta.url), 'utf8')
  const migration = readFileSync(new URL('../migrations/0000_baseline.sql', import.meta.url), 'utf8')
  assert.match(source, /pg_advisory_xact_lock/)
  assert.match(source, /quote\.status !== 'ACCEPTED'/)
  assert.match(source, /serviceRequestQuoteLine/)
  assert.match(migration, /request_uidx/)
})
