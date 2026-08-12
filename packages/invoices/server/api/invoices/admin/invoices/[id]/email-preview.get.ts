import { requireFeatureAccess } from '@nuxt-customer-portal/core/server/portal'
import { invoicesFeature } from '@nuxt-customer-portal/invoices/shared/feature'
import { getInvoiceEmailPreview } from '@nuxt-customer-portal/invoices/server/utils/invoice-email'

defineRouteMeta({
  openAPI: {
    tags: ['Invoices'],
operationId: 'invoicesAdminInvoicesByIdEmailPreviewGet',
    summary: 'Preview an invoice email',
    description: 'Preview an invoice email. Scoped to the active organization and the applicable Invoices permission.'
  }
})

export default defineEventHandler(async (event) => {
  const { organizationId } = await requireFeatureAccess(event, invoicesFeature.policy, 'manage')
  const locale = getQuery(event).locale
  return getInvoiceEmailPreview(organizationId, getRouterParam(event, 'id')!, typeof locale === 'string' ? locale : undefined)
})
