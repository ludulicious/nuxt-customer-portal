import { admin } from '@nuxt-customer-portal/products/server/utils/access'
import { saveProductPricing } from '@nuxt-customer-portal/products/server/utils/catalog'

export default defineEventHandler(async (event) => {
  const { organizationId } = await admin(event)
  return saveProductPricing(organizationId, getRouterParam(event, 'id')!, await readBody(event))
})
