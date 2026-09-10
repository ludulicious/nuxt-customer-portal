import { admin } from '@nuxt-customer-portal/products/server/utils/access'
import { listProducts } from '@nuxt-customer-portal/products/server/utils/catalog'

export default defineEventHandler(async (event) => {
  const { organizationId } = await admin(event)
  return listProducts(organizationId, getQuery(event))
})
