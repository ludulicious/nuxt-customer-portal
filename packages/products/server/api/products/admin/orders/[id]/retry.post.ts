import { admin } from '@nuxt-customer-portal/products/server/utils/access'
import { rows } from '@nuxt-customer-portal/products/server/utils/database'
import { reconcileCheckout, processOrder } from '@nuxt-customer-portal/products/server/utils/orders'
import { reconcilePayment } from '@nuxt-customer-portal/products/server/utils/webhooks'
import type { Order } from '@nuxt-customer-portal/products/shared/types'

export default defineEventHandler(async (event) => {
  const { organizationId } = await admin(event)
  const [order] = await rows<Order>('SELECT * FROM products.purchase WHERE id=$1 AND store_id=$2', [
    getRouterParam(event, 'id'),
    organizationId
  ])
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
