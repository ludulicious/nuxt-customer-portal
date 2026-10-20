import { admin } from '@nuxt-customer-portal/products/server/utils/access'
import { cancelOffer } from '@nuxt-customer-portal/products/server/utils/offers'

export default defineEventHandler(async (event) => {
  const { organizationId } = await admin(event)
  return cancelOffer(organizationId, getRouterParam(event, 'id')!, getRouterParam(event, 'offerId')!)
})
