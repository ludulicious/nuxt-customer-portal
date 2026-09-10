import { getStore } from '@nuxt-customer-portal/products/server/utils/access'
import { rows } from '@nuxt-customer-portal/products/server/utils/database'
import { assetUrl } from '@nuxt-customer-portal/products/server/utils/storage'

export default defineEventHandler(async (event) => {
  const store = await getStore(true),
    id = getRouterParam(event, 'id')!
  const [asset] = await rows(
    `SELECT a.id FROM products.asset a JOIN products.product p ON p.id=a.product_id WHERE a.id=$1 AND a.visibility='public' AND a.ready AND p.store_id=$2 AND p.data->>'status'='published' AND p.data->'imageIds' ? $1`,
    [id, store.organization_id]
  )
  if (!asset) {
    throw createError({ statusCode: 404 })
  }
  setHeader(event, 'Cache-Control', 'no-store')
  return sendRedirect(event, await assetUrl(id))
})
