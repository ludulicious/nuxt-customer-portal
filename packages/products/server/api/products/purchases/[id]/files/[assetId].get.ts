import { claimPurchases, hasAccess, getOrder } from '@nuxt-customer-portal/products/server/utils/orders'
import { sendAsset } from '@nuxt-customer-portal/products/server/utils/storage'

export default defineEventHandler(async (event) => {
  const userId = await claimPurchases(event),
    assetId = getRouterParam(event, 'assetId')!
  const order = await getOrder(getRouterParam(event, 'id')!)
  const line = order?.lines.find((item) => hasAccess(order, item) && item.snapshot.product.fileIds.includes(assetId))
  if (!order || order.buyer_id !== userId || !line) {
    throw createError({ statusCode: 404 })
  }
  setHeader(event, 'Cache-Control', 'no-store')
  const fileName = line.snapshot.product.fileNames?.[assetId]?.[order.snapshot.locale]
  return sendAsset(event, assetId, getQuery(event).download === '1', fileName)
})
