import { claimPurchases, hasAccess, getOrder } from '@nuxt-customer-portal/products/server/utils/orders'
import { sendPurchasedAsset } from '@nuxt-customer-portal/products/server/utils/downloads'

export default defineEventHandler(async (event) => {
  const userId = await claimPurchases(event),
    assetId = getRouterParam(event, 'assetId')!
  const order = await getOrder(getRouterParam(event, 'id')!)
  const line = order?.lines.find((item) => hasAccess(order, item) && item.snapshot.product.fileIds.includes(assetId))
  if (!order || order.buyer_id !== userId || !line) {
    throw createError({ statusCode: 404 })
  }
  setHeader(event, 'Cache-Control', 'no-store')
  return sendPurchasedAsset(event, order, assetId, 'portal', getQuery(event).download === '1')
})
