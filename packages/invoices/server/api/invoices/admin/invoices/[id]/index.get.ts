import { requireFeatureAccess } from '@nuxt-customer-portal/core/server/portal'
import { invoicesFeature } from '@nuxt-customer-portal/invoices/shared/feature'
import { getInvoice } from '@nuxt-customer-portal/invoices/server/utils/invoice-repository'

defineRouteMeta({
  openAPI: {
    tags: ['Invoices'],
operationId: 'invoicesAdminInvoicesByIdGet',
    summary: 'Get an invoice',
    description: 'Get an invoice. Scoped to the active organization and the applicable Invoices permission.'
  }
})

export default defineEventHandler(async (event) => {
  const { organizationId } = await requireFeatureAccess(event, invoicesFeature.policy, 'manage')
  return getInvoice(organizationId, getRouterParam(event, 'id')!)
})
