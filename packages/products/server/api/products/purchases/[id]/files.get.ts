import { claimPurchases, hasAccess, getOrder } from '@nuxt-customer-portal/products/server/utils/orders'
import { rows } from '@nuxt-customer-portal/products/server/utils/database'

export default defineEventHandler(async (event) => {
  const userId = await claimPurchases(event)
  const order = await getOrder(getRouterParam(event, 'id')!)
  if (!order || order.buyer_id !== userId || !hasAccess(order)) {
    throw createError({ statusCode: 404 })
  }
  const accessibleLines = order.lines.filter((line) => hasAccess(order, line))
  const fileIds = [...new Set(accessibleLines.flatMap((line) => line.snapshot.product.fileIds))]
  const assets = await rows<{ id: string; name: string; content_type: string; size: number }>(
    'SELECT id,name,content_type,size FROM products.asset WHERE ready AND id=ANY($1::text[])',
    [fileIds]
  )
  return assets.map((asset) => ({
    ...asset,
    name:
      accessibleLines.find((line) => line.snapshot.product.fileIds.includes(asset.id))?.snapshot.product.fileNames?.[
        asset.id
      ]?.[order.snapshot.locale] || asset.name
  }))
})
