import { parseInput } from '@nuxt-customer-portal/products/server/utils/validation'
import { catalogAccess } from '@nuxt-customer-portal/products/server/utils/access'
import { getProduct, publicProduct } from '@nuxt-customer-portal/products/server/utils/catalog'
import { listSchema } from '@nuxt-customer-portal/products/shared/validation'

defineRouteMeta({
  openAPI: {
    operationId: 'storeProduct',
    tags: ['Store'],
    summary: 'Read a published or draft product',
    security: [{ catalogKey: [] }]
  }
})
export default defineEventHandler(async (event) => {
  const q = parseInput(listSchema, getQuery(event))
  if (q.status === 'archived') {
    throw createError({ statusCode: 400, message: 'Archived products are not available through the Store API' })
  }
  const visibility = q.status === 'draft' ? 'draft' : 'published'
  const store = await catalogAccess(event, visibility)
  setHeader(event, 'Cache-Control', 'private, no-store')
  const product = await getProduct(store.organization_id, getRouterParam(event, 'slug')!, true)
  if (product.status !== visibility) {
    throw createError({ statusCode: 404 })
  }
  return publicProduct(product, q.locale, q.currency)
})
