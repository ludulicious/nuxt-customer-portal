import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

test('draft deletion requires active-organization manage permission', () => {
  const route = readFileSync(new URL('../server/api/invoices/admin/invoices/[id].delete.ts', import.meta.url), 'utf8')
  assert.match(route, /requireFeatureAccess\(event, invoicesFeature.policy, 'manage'\)/)
  assert.match(route, /deleteDraftInvoice\(organizationId, getRouterParam\(event, 'id'\)!\)/)
})

test('draft deletion uses a destructive confirmation, typed composable and originating-list navigation', () => {
  const component = readFileSync(new URL('../app/components/InvoicesInvoiceDetail.vue', import.meta.url), 'utf8')
  assert.match(component, /if \(props.invoice.status === 'DRAFT'\) \{[\s\S]*?deleteDraftInvoice/)
  assert.match(component, /v-if="!isClient && deleteConfirmationOpen"\s+v-model:open="deleteConfirmationOpen"/)
  assert.match(component, /confirm-color="error"\s+@confirm="deleteDraft"/)
  assert.match(component, /await api.deleteInvoice\(props.invoice.id\)/)
  assert.match(component, /navigateTo\(props.backTo \|\| '\/admin\/invoices'\)/)
  const composable = readFileSync(new URL('../app/composables/useInvoices.ts', import.meta.url), 'utf8')
  assert.match(composable, /deleteInvoice:[\s\S]*?method: 'DELETE'/)
  for (const locale of ['en', 'nl']) {
    const messages = JSON.parse(readFileSync(new URL(`../i18n/locales/${locale}.json`, import.meta.url), 'utf8'))
    for (const key of ['deleteDraftInvoice', 'deleteDraftInvoiceDescription', 'invoiceDeleted']) {
      assert.ok(messages.features.invoices.admin[key])
    }
  }
})

test('invoice children and timesheet links cascade without deleting time entries', () => {
  const schema = readFileSync(new URL('../server/db/schema/invoices.ts', import.meta.url), 'utf8')
  for (const table of [
    'invoiceLine',
    'invoicePayment',
    'invoiceHistory',
    'invoiceAttachment',
    'invoiceEmailDelivery'
  ]) {
    const definition = schema.split(`export const ${table} =`)[1]!.split('export const ')[0]!
    assert.match(definition, /references\(\(\) => invoice.id, \{ onDelete: 'cascade' \}\)/)
  }
  const bridge = readFileSync(
    new URL('../../invoice-timesheets/server/db/schema/invoice-timesheets.ts', import.meta.url),
    'utf8'
  )
  assert.match(bridge, /references\(\(\) => invoice.id, \{ onDelete: 'cascade' \}\)/)
  assert.match(bridge, /references\(\(\) => timeEntry.id, \{ onDelete: 'restrict' \}\)/)
})
