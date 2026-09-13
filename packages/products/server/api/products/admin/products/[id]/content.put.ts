import { admin } from '@nuxt-customer-portal/products/server/utils/access'
import { saveProductContent } from '@nuxt-customer-portal/products/server/utils/catalog'

export default defineEventHandler(async (event) => {
  const { organizationId } = await admin(event)
  return saveProductContent(organizationId, getRouterParam(event, 'id')!, await readBody(event))
})
