import { requireFeatureAccess } from '@nuxt-customer-portal/core/server/portal'
import { invoicesFeature } from '@nuxt-customer-portal/invoices/shared/feature'
import { deliverInvoiceEmail } from '@nuxt-customer-portal/invoices/server/utils/invoice-email'
import { invoiceEmailDeliverySchema } from '@nuxt-customer-portal/invoices/server/utils/invoice-validation'

defineRouteMeta({
  openAPI: {
    tags: ['Invoices'],
operationId: 'invoicesAdminInvoicesByIdReminderPost',
    summary: 'Send an invoice reminder',
    description: 'Send an invoice reminder. Scoped to the active organization and the applicable Invoices permission.'
  }
})

export default defineEventHandler(async (event) => {
  const { organizationId, session } = await requireFeatureAccess(event, invoicesFeature.policy, 'manage')
  return deliverInvoiceEmail(
    organizationId,
    session.user.id,
    getRouterParam(event, 'id')!,
    invoiceEmailDeliverySchema.parse(await readBody(event)),
    false,
    'REMINDER'
  )
})
