import { requireFeatureAccess } from '@nuxt-customer-portal/core/server/portal'
import { invoicesFeature } from '@nuxt-customer-portal/invoices/shared/feature'
import { deleteBillingContact } from '@nuxt-customer-portal/invoices/server/utils/invoice-repository'

export default defineEventHandler(async (event) => {
  await requireFeatureAccess(event, invoicesFeature.policy, 'manage')
  return deleteBillingContact(getRouterParam(event, 'clientId')!, getRouterParam(event, 'id')!)
})
