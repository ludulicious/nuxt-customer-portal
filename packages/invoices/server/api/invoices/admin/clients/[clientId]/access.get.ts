import { requireFeatureAccess } from '@nuxt-customer-portal/core/server/portal'
import { invoicesFeature } from '@nuxt-customer-portal/invoices/shared/feature'
import { getClientInvoiceAccessOverview } from '@nuxt-customer-portal/invoices/server/utils/invoice-repository'

export default defineEventHandler(async (event) => {
  const { organizationId, organizationType } = await requireFeatureAccess(event, invoicesFeature.policy, 'manage')
  if (organizationType !== 'PROVIDER') {
    throw createError({ statusCode: 403, message: 'Access denied' })
  }
  return getClientInvoiceAccessOverview(organizationId, getRouterParam(event, 'clientId')!)
})
