import { claimPurchases, hasAccess } from '@nuxt-customer-portal/products/server/utils/orders'
import { rows } from '@nuxt-customer-portal/products/server/utils/database'
import { assetUrl } from '@nuxt-customer-portal/products/server/utils/storage'
import type { Order } from '@nuxt-customer-portal/products/shared/types'

export default defineEventHandler(async (event) => {
  const userId = await claimPurchases(event),
    assetId = getRouterParam(event, 'assetId')!
  const [order] = await rows<Order>('SELECT * FROM products.purchase WHERE id=$1 AND buyer_id=$2', [
    getRouterParam(event, 'id'),
    userId
  ])
  if (!order || !hasAccess(order) || !order.snapshot.product.fileIds.includes(assetId)) {
    throw createError({ statusCode: 404 })
  }
  setHeader(event, 'Cache-Control', 'no-store')
  return sendRedirect(event, await assetUrl(assetId, getQuery(event).download === '1'))
})
