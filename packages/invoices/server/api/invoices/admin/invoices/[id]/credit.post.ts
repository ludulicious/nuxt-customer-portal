import { requireFeatureAccess } from '@nuxt-customer-portal/core/server/portal'
import { invoicesFeature } from '@nuxt-customer-portal/invoices/shared/feature'
import { copyInvoice } from '@nuxt-customer-portal/invoices/server/utils/invoice-repository'

defineRouteMeta({
  openAPI: {
    tags: ['Invoices'],
    operationId: 'invoicesAdminInvoicesByIdCreditPost',
    summary: 'Credit an invoice',
    description:
      'Create a full draft credit note for an issued or paid invoice in the active organization. Requires Invoices manage permission.'
  }
})

export default defineEventHandler(async (event) => {
  const { organizationId, session } = await requireFeatureAccess(event, invoicesFeature.policy, 'manage')
  return copyInvoice(organizationId, session.user.id, getRouterParam(event, 'id')!, true)
})
