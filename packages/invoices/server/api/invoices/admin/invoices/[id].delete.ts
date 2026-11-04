import { requireFeatureAccess } from '@nuxt-customer-portal/core/server/portal'
import { invoicesFeature } from '@nuxt-customer-portal/invoices/shared/feature'
import { deleteDraftInvoice } from '@nuxt-customer-portal/invoices/server/utils/invoice-repository'

defineRouteMeta({
  openAPI: {
    tags: ['Invoices'],
    operationId: 'invoicesAdminInvoicesByIdDelete',
    summary: 'Delete a draft invoice',
    description: 'Permanently delete an unissued draft in the active organization. Requires Invoices manage permission.'
  }
})

export default defineEventHandler(async (event) => {
  const { organizationId } = await requireFeatureAccess(event, invoicesFeature.policy, 'manage')
  return deleteDraftInvoice(organizationId, getRouterParam(event, 'id')!)
})
