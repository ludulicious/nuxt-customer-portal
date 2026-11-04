import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { suggestedInvoiceContact } from '../shared/invoice-recipient'
import { invoiceRecipientRefreshSchema } from '../server/utils/invoice-validation'

test('recipient refresh matches current contacts by email or name without guessing between multiple contacts', () => {
  const contacts = [
    { id: 'one', name: 'Current Name', email: 'current@example.test' },
    { id: 'two', name: 'Other Person', email: 'other@example.test' }
  ]
  assert.equal(
    suggestedInvoiceContact({ recipientEmail: ' CURRENT@example.test ', recipientContactName: 'Old Name' }, contacts),
    'one'
  )
  assert.equal(
    suggestedInvoiceContact({ recipientEmail: 'old@example.test', recipientContactName: 'Current Name' }, contacts),
    'one'
  )
  assert.equal(
    suggestedInvoiceContact({ recipientEmail: 'old@example.test', recipientContactName: 'Old Name' }, contacts),
    null
  )
  assert.equal(
    suggestedInvoiceContact({ recipientEmail: null, recipientContactName: null }, contacts.slice(0, 1)),
    'one'
  )
  assert.equal(suggestedInvoiceContact({ recipientEmail: null, recipientContactName: null }, []), null)
})

test('recipient updates validate contact selection and reject client-supplied snapshot overrides', () => {
  assert.deepEqual(invoiceRecipientRefreshSchema.parse({ contactId: null }), { contactId: null })
  assert.equal(invoiceRecipientRefreshSchema.safeParse({ contactId: 'contact' }).success, true)
  assert.equal(invoiceRecipientRefreshSchema.safeParse({ contactId: '' }).success, false)
  assert.equal(
    invoiceRecipientRefreshSchema.safeParse({ contactId: null, recipientName: 'Forged name' }).success,
    false
  )
  for (const method of ['get', 'put']) {
    const route = readFileSync(
      new URL(`../server/api/invoices/admin/invoices/[id]/recipient.${method}.ts`, import.meta.url),
      'utf8'
    )
    assert.match(route, /requireFeatureAccess\(event, invoicesFeature.policy, 'manage'\)/)
    assert.match(route, /organizationId/)
  }
})

test('draft recipient editing uses a conditionally mounted validated Nuxt UI form', () => {
  const component = readFileSync(new URL('../app/components/InvoicesInvoiceDetail.vue', import.meta.url), 'utf8')
  assert.match(component, /!isClient && invoice.status === 'DRAFT' && invoice.clientOrganizationId/)
  assert.match(component, /v-if="!isClient && recipientRefreshOpen"\s+v-model:open="recipientRefreshOpen"/)
  const form = readFileSync(new URL('../app/components/InvoicesRecipientRefreshModal.vue', import.meta.url), 'utf8')
  assert.match(form, /<UModal v-if="open" v-model:open="open"/)
  assert.match(form, /<UForm[^>]+:schema="schema"[^>]+novalidate/)
  assert.match(form, /const schema = z.object/)
  assert.match(form, /api.refreshInvoiceRecipient/)
  for (const locale of ['en', 'nl']) {
    const messages = JSON.parse(readFileSync(new URL(`../i18n/locales/${locale}.json`, import.meta.url), 'utf8'))
    for (const key of [
      'refreshRecipient',
      'refreshRecipientDescription',
      'recipientContact',
      'noRecipientContact',
      'recipientRefreshed',
      'loadingRecipient',
      'retryRecipient'
    ]) {
      assert.ok(messages.features.invoices.admin[key])
    }
  }
})
