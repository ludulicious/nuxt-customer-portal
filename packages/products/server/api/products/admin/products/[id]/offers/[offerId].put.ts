import { admin } from '@nuxt-customer-portal/products/server/utils/access'
import { saveOffer } from '@nuxt-customer-portal/products/server/utils/offers'

export default defineEventHandler(async (event) => {
  const { organizationId } = await admin(event)
  return saveOffer(
    organizationId,
    getRouterParam(event, 'id')!,
    await readBody(event),
    getRouterParam(event, 'offerId')!
  )
})
