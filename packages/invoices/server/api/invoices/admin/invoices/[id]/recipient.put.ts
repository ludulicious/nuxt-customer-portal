import { requireFeatureAccess } from '@nuxt-customer-portal/core/server/portal'
import { invoicesFeature } from '@nuxt-customer-portal/invoices/shared/feature'
import { refreshDraftInvoiceRecipient } from '@nuxt-customer-portal/invoices/server/utils/invoice-repository'
import { invoiceRecipientRefreshSchema } from '@nuxt-customer-portal/invoices/server/utils/invoice-validation'

defineRouteMeta({
  openAPI: {
    tags: ['Invoices'],
    operationId: 'invoicesAdminInvoicesByIdRecipientPut',
    summary: 'Refresh draft invoice recipient details',
    description:
      'Refresh a draft from current client billing data in the active organization. Requires Invoices manage permission.'
  }
})

export default defineEventHandler(async (event) => {
  const { organizationId, session } = await requireFeatureAccess(event, invoicesFeature.policy, 'manage')
  const input = invoiceRecipientRefreshSchema.parse(await readBody(event))
  return refreshDraftInvoiceRecipient(organizationId, session.user.id, getRouterParam(event, 'id')!, input.contactId)
})
