import { parseInput } from '@nuxt-customer-portal/products/server/utils/validation'
import { catalogAccess } from '@nuxt-customer-portal/products/server/utils/access'
import { listProducts, publicProduct } from '@nuxt-customer-portal/products/server/utils/catalog'
import { listSchema } from '@nuxt-customer-portal/products/shared/validation'

defineRouteMeta({
  openAPI: {
    operationId: 'storeCatalog',
    tags: ['Store'],
    summary: 'Read the published or draft catalog',
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
  const page = await listProducts(store.organization_id, { ...q, status: visibility }, false)
  return { ...page, items: await Promise.all(page.items.map((p) => publicProduct(p, q.locale, q.currency))) }
})
