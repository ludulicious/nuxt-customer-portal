import { admin } from '@nuxt-customer-portal/products/server/utils/access'
import { getProduct } from '@nuxt-customer-portal/products/server/utils/catalog'
import { rows } from '@nuxt-customer-portal/products/server/utils/database'
import { assetUrl } from '@nuxt-customer-portal/products/server/utils/storage'

export default defineEventHandler(async (event) => {
  const { organizationId } = await admin(event)
  const product = await getProduct(organizationId, getRouterParam(event, 'id')!)
  const id = getRouterParam(event, 'assetId')!
  if (!product.imageIds.includes(id)) {
    throw createError({ statusCode: 404 })
  }
  const [asset] = await rows(
    "SELECT id FROM products.asset WHERE id=$1 AND product_id=$2 AND visibility='public' AND ready",
    [id, product.id]
  )
  if (!asset) {
    throw createError({ statusCode: 404 })
  }
  setHeader(event, 'Cache-Control', 'no-store')
  return sendRedirect(event, await assetUrl(id))
})
