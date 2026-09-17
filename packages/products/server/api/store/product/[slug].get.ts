import { parseInput } from '@nuxt-customer-portal/products/server/utils/validation'
import { getStore, publicLimit } from '@nuxt-customer-portal/products/server/utils/access'
import { getProduct, publicProduct } from '@nuxt-customer-portal/products/server/utils/catalog'
import { listSchema } from '@nuxt-customer-portal/products/shared/validation'

export default defineEventHandler(async (event) => {
  await publicLimit(event)
  const store = await getStore(true),
    q = parseInput(listSchema, getQuery(event))
  const product = await getProduct(store.organization_id, getRouterParam(event, 'slug')!, true)
  if (product.status !== 'published') {
    throw createError({ statusCode: 404 })
  }
  setHeader(event, 'Cache-Control', 'no-store')
  return publicProduct(product, q.locale, q.currency)
})
