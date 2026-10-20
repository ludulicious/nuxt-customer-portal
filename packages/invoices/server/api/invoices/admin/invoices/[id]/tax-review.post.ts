import { requireFeatureAccess } from '@nuxt-customer-portal/core/server/portal'
import { invoicesFeature } from '@nuxt-customer-portal/invoices/shared/feature'
import { invoiceTaxReviewSchema } from '@nuxt-customer-portal/invoices/server/utils/invoice-validation'
import { reviewDeferredInvoiceTax } from '@nuxt-customer-portal/invoices/server/utils/deferred-invoice'

export default defineEventHandler(async (event) => {
  const { organizationId, session } = await requireFeatureAccess(event, invoicesFeature.policy, 'manage')
  return reviewDeferredInvoiceTax(
    organizationId,
    session.user.id,
    getRouterParam(event, 'id')!,
    invoiceTaxReviewSchema.parse(await readBody(event)).rates
  )
})
