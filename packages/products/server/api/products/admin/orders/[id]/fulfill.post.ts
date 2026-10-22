import { admin } from '@nuxt-customer-portal/products/server/utils/access'
import { fulfillOrder } from '@nuxt-customer-portal/products/server/utils/orders'

export default defineEventHandler(async (event) => {
  const { organizationId } = await admin(event)
  await fulfillOrder(organizationId, getRouterParam(event, 'id')!)
  return { ok: true }
})
