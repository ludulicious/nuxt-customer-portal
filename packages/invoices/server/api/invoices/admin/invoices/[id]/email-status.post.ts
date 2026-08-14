import { requireFeatureAccess } from '@nuxt-customer-portal/core/server/portal'
import { invoicesFeature } from '@nuxt-customer-portal/invoices/shared/feature'
import { refreshInvoiceEmailStatuses } from '@nuxt-customer-portal/invoices/server/utils/invoice-email-status'

defineRouteMeta({
  openAPI: {
    tags: ['Invoices'],
operationId: 'invoicesAdminInvoicesByIdEmailStatusPost',
    summary: 'Refresh invoice email delivery status',
    description: 'Refresh invoice email delivery status. Scoped to the active organization and the applicable Invoices permission.'
  }
})

export default defineEventHandler(async (event) => {
  const { organizationId } = await requireFeatureAccess(event, invoicesFeature.policy, 'manage')
  return refreshInvoiceEmailStatuses(
    organizationId,
    getRouterParam(event, 'id')!,
    getQuery(event).refresh === '1'
  )
})
