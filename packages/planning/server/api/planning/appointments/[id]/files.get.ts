import { getRouterParam } from 'h3'
import { appointmentAccess } from '@nuxt-customer-portal/planning/server/utils/access'
import { rows } from '@nuxt-customer-portal/products/server/utils/database'
import { getOrder, hasAccess } from '@nuxt-customer-portal/products/server/utils/orders'

export default defineEventHandler(async (event) => {
  const { appointment } = await appointmentAccess(event, getRouterParam(event, 'id')!)
  const order = await getOrder(appointment.order_id)
  if (!order) {
    throw createError({ statusCode: 404 })
  }
  const accessibleLines = order.lines.filter((line) => hasAccess(order, line))
  const fileIds = [...new Set(accessibleLines.flatMap((line) => line.snapshot.product.fileIds))]
  if (!fileIds.length) {
    return []
  }
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
