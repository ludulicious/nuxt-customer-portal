import { requireFeatureAccess } from '@nuxt-customer-portal/core/server/portal'
import { invoicesFeature } from '@nuxt-customer-portal/invoices/shared/feature'
import { registerInvoicePayment } from '@nuxt-customer-portal/invoices/server/utils/invoice-repository'
import { invoicePaymentSchema } from '@nuxt-customer-portal/invoices/server/utils/invoice-validation'

defineRouteMeta({
  openAPI: {
    tags: ['Invoices'],
    operationId: 'invoicesAdminInvoicesByIdPaymentsPost',
    summary: 'Register an invoice payment',
    description:
      'Register an invoice payment. Scoped to the active organization and the applicable Invoices permission.'
  }
})

export default defineEventHandler(async (event) => {
  const { organizationId, session } = await requireFeatureAccess(event, invoicesFeature.policy, 'manage')
  return registerInvoicePayment(
    organizationId,
    session.user.id,
    getRouterParam(event, 'id')!,
    invoicePaymentSchema.parse(await readBody(event))
  )
})
