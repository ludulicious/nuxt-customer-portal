import { requireFeatureAccess } from '@nuxt-customer-portal/core/server/portal'
import { invoicesFeature } from '@nuxt-customer-portal/invoices/shared/feature'
import { deliverInvoiceEmail } from '@nuxt-customer-portal/invoices/server/utils/invoice-email'
import { invoiceEmailDeliverySchema } from '@nuxt-customer-portal/invoices/server/utils/invoice-validation'

defineRouteMeta({
  openAPI: {
    tags: ['Invoices'],
    operationId: 'invoicesAdminInvoicesByIdIssuePost',
    summary: 'Issue an invoice',
    description: 'Issue an invoice. Scoped to the active organization and the applicable Invoices permission.'
  }
})

export default defineEventHandler(async (event) => {
  const { organizationId, session } = await requireFeatureAccess(event, invoicesFeature.policy, 'manage')
  return deliverInvoiceEmail(
    organizationId,
    session.user.id,
    getRouterParam(event, 'id')!,
    invoiceEmailDeliverySchema.parse(await readBody(event)),
    true
  )
})
