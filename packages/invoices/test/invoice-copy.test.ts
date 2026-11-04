import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { canCreditInvoice, copiedInvoiceDates, copyInvoiceLines, invoiceLineAmount } from '../shared/invoice-copy'

test('duplicate lines preserve quantities, prices, VAT details and source values', () => {
  const source = [
    {
      description: 'Consulting',
      quantityMilli: 1500,
      unitPriceMinor: 101,
      vatRateBasisPoints: 2100,
      exactTaxMinor: 33,
      taxDetails: { source: 'stripe' }
    }
  ]
  const result = copyInvoiceLines(source, false)
  assert.deepEqual(result, source)
  assert.notEqual(result[0], source[0])
  assert.equal(source[0]!.unitPriceMinor, 101)
})

test('credit lines reverse rounded amounts and authoritative tax exactly', () => {
  for (const quantityMilli of [1, 500, 1000, 1500, 3333]) {
    for (const unitPriceMinor of [1, 3, 101, 10000]) {
      for (const vatRateBasisPoints of [0, 900, 2100]) {
        for (const exactTaxMinor of [null, 0, 13]) {
          const source = { quantityMilli, unitPriceMinor, vatRateBasisPoints, exactTaxMinor }
          const [credit] = copyInvoiceLines([source], true)
          const net = invoiceLineAmount(quantityMilli, unitPriceMinor)
          const tax = exactTaxMinor ?? Math.round((net * vatRateBasisPoints) / 10000)
          assert.equal(
            invoiceLineAmount(credit!.quantityMilli, credit!.unitPriceMinor) + credit!.exactTaxMinor!,
            -(net + tax)
          )
          assert.equal(credit!.quantityMilli, quantityMilli)
          assert.equal(source.unitPriceMinor, unitPriceMinor)
        }
      }
    }
  }
})

test('only issued or paid positive invoices are eligible for full credit', () => {
  for (const status of ['DRAFT', 'ISSUED', 'PAID', 'VOID'] as const) {
    const eligible = ['ISSUED', 'PAID'].includes(status)
    assert.equal(canCreditInvoice({ status, documentType: 'invoice', totalMinor: 121 }), eligible)
    assert.equal(canCreditInvoice({ status, documentType: 'credit', totalMinor: 121 }), false)
    assert.equal(canCreditInvoice({ status, totalMinor: 0 }), false)
    assert.equal(canCreditInvoice({ status, totalMinor: -121 }), false)
  }
})

test('copied dates reset to today and retain the payment term across year boundaries', () => {
  assert.deepEqual(
    copiedInvoiceDates({ issueDate: '2026-01-01', dueDate: '2026-01-31' }, new Date('2026-12-20T15:00:00Z')),
    { issueDate: '2026-12-20', dueDate: '2027-01-19' }
  )
  assert.deepEqual(
    copiedInvoiceDates({ issueDate: '2026-01-02', dueDate: '2026-01-01' }, new Date('2026-11-04T15:00:00Z')),
    { issueDate: '2026-11-04', dueDate: '2026-11-04' }
  )
})

test('both mutation routes enforce active-organization manage access', () => {
  for (const action of ['duplicate', 'credit']) {
    const route = readFileSync(
      new URL(`../server/api/invoices/admin/invoices/[id]/${action}.post.ts`, import.meta.url),
      'utf8'
    )
    assert.match(route, /requireFeatureAccess\(event, invoicesFeature.policy, 'manage'\)/)
    assert.match(route, /copyInvoice\(organizationId, session.user.id, getRouterParam\(event, 'id'\)!/)
  }
})

test('menu actions and draft credit confirmation have matching English and Dutch translations', () => {
  const component = readFileSync(new URL('../app/components/InvoicesInvoiceDetail.vue', import.meta.url), 'utf8')
  assert.match(component, /v-if="!isClient && creditConfirmationOpen"\s+v-model:open="creditConfirmationOpen"/)
  assert.match(component, /if \(!isClient.value\) \{\s+items.push\(\.\.\.menuItems.value\)/)
  assert.match(component, /navigateTo\(`\/admin\/invoices\/\$\{created.id\}`\)/)
  assert.match(component, /props.invoice.status === 'ISSUED' && props.invoice.outstandingMinor > 0/)
  assert.match(component, /invoice.status === 'ISSUED' && invoice.outstandingMinor > 0"/)
  for (const locale of ['en', 'nl']) {
    const messages = JSON.parse(readFileSync(new URL(`../i18n/locales/${locale}.json`, import.meta.url), 'utf8'))
    for (const key of [
      'duplicateInvoice',
      'creditInvoice',
      'creditCreated',
      'invoiceDuplicated',
      'creditInvoiceDescription'
    ]) {
      assert.ok(messages.features.invoices.admin[key])
    }
  }
})
