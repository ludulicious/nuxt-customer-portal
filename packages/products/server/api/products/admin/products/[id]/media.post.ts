import { admin } from '@nuxt-customer-portal/products/server/utils/access'
import { linkProductMedia } from '@nuxt-customer-portal/products/server/utils/product-media'

export default defineEventHandler(async (event) => {
  const { organizationId } = await admin(event)
  return linkProductMedia(organizationId, getRouterParam(event, 'id')!, await readBody(event))
})
