import { requireFeatureAccess } from '@nuxt-customer-portal/core/server/portal'
import { invoicesFeature } from '@nuxt-customer-portal/invoices/shared/feature'
import { createBillingContact } from '@nuxt-customer-portal/invoices/server/utils/invoice-repository'
import { billingContactCreateSchema } from '@nuxt-customer-portal/invoices/server/utils/invoice-validation'

export default defineEventHandler(async (event) => {
  await requireFeatureAccess(event, invoicesFeature.policy, 'manage')
  return createBillingContact(getRouterParam(event, 'clientId')!, billingContactCreateSchema.parse(await readBody(event)))
})
