import { admin } from '@nuxt-customer-portal/products/server/utils/access'
import { getOrder, reconcileCheckout, processOrder } from '@nuxt-customer-portal/products/server/utils/orders'
import { reconcilePayment } from '@nuxt-customer-portal/products/server/utils/webhooks'

export default defineEventHandler(async (event) => {
  const { organizationId } = await admin(event)
  const order = await getOrder(getRouterParam(event, 'id')!)
  if (order?.store_id !== organizationId) {
    throw createError({ statusCode: 404 })
  }
  if (!order) {
    throw createError({ statusCode: 404 })
  }
  if (order.checkout_id) {
    await reconcileCheckout(order.checkout_id)
  }
  if (order.payment_id) {
    await reconcilePayment(order.payment_id)
  }
  await processOrder(order.id)
  return { ok: true }
})
