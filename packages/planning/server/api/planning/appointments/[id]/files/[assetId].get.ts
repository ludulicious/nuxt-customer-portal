import { getQuery, getRouterParam, setHeader } from 'h3'
import { appointmentAccess } from '@nuxt-customer-portal/planning/server/utils/access'
import { getOrder, hasAccess } from '@nuxt-customer-portal/products/server/utils/orders'
import { sendAsset } from '@nuxt-customer-portal/products/server/utils/storage'

export default defineEventHandler(async (event) => {
  const { appointment } = await appointmentAccess(event, getRouterParam(event, 'id')!)
  const assetId = getRouterParam(event, 'assetId')!
  const order = await getOrder(appointment.order_id)
  const line = order?.lines.find((item) => hasAccess(order, item) && item.snapshot.product.fileIds.includes(assetId))
  if (!order || !line) {
    throw createError({ statusCode: 404 })
  }
  const fileName = line.snapshot.product.fileNames?.[assetId]?.[order.snapshot.locale]
  setHeader(event, 'Cache-Control', 'private, no-store')
  return sendAsset(event, assetId, getQuery(event).download === '1', fileName)
})
