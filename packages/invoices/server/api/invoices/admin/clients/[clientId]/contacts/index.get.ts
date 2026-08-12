import { requireFeatureAccess } from '@nuxt-customer-portal/core/server/portal'
import { invoicesFeature } from '@nuxt-customer-portal/invoices/shared/feature'
import { listBillingContacts } from '@nuxt-customer-portal/invoices/server/utils/invoice-repository'

export default defineEventHandler(async (event) => {
  await requireFeatureAccess(event, invoicesFeature.policy, 'manage')
  return listBillingContacts(getRouterParam(event, 'clientId')!)
})
