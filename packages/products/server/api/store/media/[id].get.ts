import { catalogAccess } from '@nuxt-customer-portal/products/server/utils/access'
import { rows } from '@nuxt-customer-portal/products/server/utils/database'
import { sendAsset } from '@nuxt-customer-portal/products/server/utils/storage'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')!
  const authorization = getHeader(event, 'authorization')
  const store = authorization
    ? await catalogAccess(event, 'draft')
    : (
        await rows<{ organization_id: string }>('SELECT organization_id FROM products.store WHERE id=true AND enabled')
      )[0]

  if (!store) {
    throw createError({ statusCode: 503, message: 'Store is not available' })
  }

  const [asset] = await rows(
    `SELECT a.id FROM products.asset a JOIN products.product p ON p.id=a.product_id WHERE a.id=$1 AND a.visibility='public' AND a.ready AND p.store_id=$2 AND ($3::boolean OR p.data->>'status'='published') AND p.data->'imageIds' ? $1`,
    [id, store.organization_id, !!authorization]
  )
  if (!asset) {
    throw createError({ statusCode: 404 })
  }
  setHeader(event, 'Cache-Control', 'no-store')
  return sendAsset(event, id)
})
