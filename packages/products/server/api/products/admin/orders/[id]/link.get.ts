import { admin, baseUrl } from '@nuxt-customer-portal/products/server/utils/access'
import { getOrder } from '@nuxt-customer-portal/products/server/utils/orders'
import { orderDownloadToken } from '@nuxt-customer-portal/products/server/utils/downloads'
import { publicOrderPath } from '../../../../../../shared/purchase-media'

export default defineEventHandler(async (event) => {
  const { organizationId } = await admin(event)
  const order = await getOrder(getRouterParam(event, 'id')!)
  if (!order || order.store_id !== organizationId) {
    throw createError({ statusCode: 404 })
  }
  setHeader(event, 'Cache-Control', 'private, no-store')
  return { url: `${baseUrl()}${publicOrderPath(await orderDownloadToken(order.id))}` }
})
