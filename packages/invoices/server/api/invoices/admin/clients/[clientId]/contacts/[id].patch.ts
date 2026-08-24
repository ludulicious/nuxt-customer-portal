import { requireFeatureAccess } from '@nuxt-customer-portal/core/server/portal'
import { invoicesFeature } from '@nuxt-customer-portal/invoices/shared/feature'
import { updateBillingContact } from '@nuxt-customer-portal/invoices/server/utils/invoice-repository'
import { billingContactUpdateSchema } from '@nuxt-customer-portal/invoices/server/utils/invoice-validation'

export default defineEventHandler(async (event) => {
  await requireFeatureAccess(event, invoicesFeature.policy, 'manage')
  return updateBillingContact(
    getRouterParam(event, 'clientId')!,
    getRouterParam(event, 'id')!,
    billingContactUpdateSchema.parse(await readBody(event))
  )
})
