import { admin } from '@nuxt-customer-portal/products/server/utils/access'
import { productAssets } from '@nuxt-customer-portal/products/server/utils/product-media'
import { getProduct } from '@nuxt-customer-portal/products/server/utils/catalog'

export default defineEventHandler(async (event) => {
  const { organizationId } = await admin(event)
  const id = getRouterParam(event, 'id')!
  await getProduct(organizationId, id)
  return productAssets(id)
})
