import { admin } from '@nuxt-customer-portal/products/server/utils/access'
import { deletion } from '@nuxt-customer-portal/products/server/utils/catalog'

export default defineEventHandler(async (event) => {
  const { organizationId } = await admin(event)
  return deletion(organizationId, getRouterParam(event, 'id')!)
})
