import { parseInput } from '@nuxt-customer-portal/products/server/utils/validation'
import { getStore, publicLimit } from '@nuxt-customer-portal/products/server/utils/access'
import { getProduct, publicProduct } from '@nuxt-customer-portal/products/server/utils/catalog'
import { listSchema } from '@nuxt-customer-portal/products/shared/validation'

export default defineEventHandler(async (event) => {
  const at = new Date()
  await publicLimit(event)
  const store = await getStore(true),
    q = parseInput(listSchema, getQuery(event))
  const product = await getProduct(store.organization_id, getRouterParam(event, 'slug')!, true)
  if (product.status !== 'published') {
    throw createError({ statusCode: 404 })
  }
  setHeader(event, 'Cache-Control', 'no-store')
  if (product.visibility === 'unlisted') {
    setHeader(event, 'X-Robots-Tag', 'noindex, nofollow')
    setHeader(event, 'Cache-Control', 'private, no-store')
  }
  return publicProduct(product, q.locale, q.currency, at)
})
