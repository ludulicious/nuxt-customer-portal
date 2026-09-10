import { parseInput } from '@nuxt-customer-portal/products/server/utils/validation'
import { catalogAccess } from '@nuxt-customer-portal/products/server/utils/access'
import { listProducts, publicProduct } from '@nuxt-customer-portal/products/server/utils/catalog'
import { listSchema } from '@nuxt-customer-portal/products/shared/validation'

defineRouteMeta({
  openAPI: {
    operationId: 'storeCatalog',
    tags: ['Store'],
    summary: 'Read the published catalog',
    security: [{ catalogKey: [] }]
  }
})
export default defineEventHandler(async (event) => {
  const store = await catalogAccess(event)
  setHeader(event, 'Cache-Control', 'private, no-store')
  const q = parseInput(listSchema, getQuery(event))
  const page = await listProducts(store.organization_id, q, true)
  return { ...page, items: await Promise.all(page.items.map((p) => publicProduct(p, q.locale, q.currency))) }
})
