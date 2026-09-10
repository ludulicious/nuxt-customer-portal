import { parseInput } from '@nuxt-customer-portal/products/server/utils/validation'
import { catalogAccess } from '@nuxt-customer-portal/products/server/utils/access'
import { getProduct, publicProduct } from '@nuxt-customer-portal/products/server/utils/catalog'
import { listSchema } from '@nuxt-customer-portal/products/shared/validation'

defineRouteMeta({
  openAPI: {
    operationId: 'storeProduct',
    tags: ['Store'],
    summary: 'Read a published product',
    security: [{ catalogKey: [] }]
  }
})
export default defineEventHandler(async (event) => {
  const store = await catalogAccess(event),
    q = parseInput(listSchema, getQuery(event))
  setHeader(event, 'Cache-Control', 'private, no-store')
  const product = await getProduct(store.organization_id, getRouterParam(event, 'slug')!, true)
  if (product.status !== 'published') {
    throw createError({ statusCode: 404 })
  }
  return publicProduct(product, q.locale, q.currency)
})
