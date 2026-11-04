import { admin } from '@nuxt-customer-portal/products/server/utils/access'
import { setOfferArchived } from '@nuxt-customer-portal/products/server/utils/offers'

export default defineEventHandler(async (event) => {
  const { organizationId } = await admin(event)
  return setOfferArchived(
    organizationId,
    getRouterParam(event, 'id')!,
    getRouterParam(event, 'offerId')!,
    await readBody(event)
  )
})
