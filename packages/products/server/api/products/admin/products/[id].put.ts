import { admin } from '@nuxt-customer-portal/products/server/utils/access'
import { getProduct, saveProduct } from '@nuxt-customer-portal/products/server/utils/catalog'

export default defineEventHandler(async (event) => {
  const { organizationId } = await admin(event)
  const id = getRouterParam(event, 'id')!
  await getProduct(organizationId, id)
  return saveProduct(organizationId, await readBody(event), id)
})
