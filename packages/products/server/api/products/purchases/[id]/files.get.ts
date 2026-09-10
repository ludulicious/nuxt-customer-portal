import { claimPurchases, hasAccess } from '@nuxt-customer-portal/products/server/utils/orders'
import { rows } from '@nuxt-customer-portal/products/server/utils/database'
import type { Order } from '@nuxt-customer-portal/products/shared/types'

export default defineEventHandler(async (event) => {
  const userId = await claimPurchases(event)
  const [order] = await rows<Order>('SELECT * FROM products.purchase WHERE id=$1 AND buyer_id=$2', [
    getRouterParam(event, 'id'),
    userId
  ])
  if (!order || !hasAccess(order)) {
    throw createError({ statusCode: 404 })
  }
  return rows('SELECT id,name,content_type,size FROM products.asset WHERE ready AND id=ANY($1::text[])', [
    order.snapshot.product.fileIds
  ])
})
