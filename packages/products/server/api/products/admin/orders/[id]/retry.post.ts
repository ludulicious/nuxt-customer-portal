import { admin } from '@nuxt-customer-portal/products/server/utils/access'
import { getOrder, reconcileCheckout, processOrder } from '@nuxt-customer-portal/products/server/utils/orders'
import { reconcilePayment } from '@nuxt-customer-portal/products/server/utils/webhooks'
import { developmentSandboxEffectsEnabled } from '@nuxt-customer-portal/products/server/utils/development'
import { rows } from '@nuxt-customer-portal/products/server/utils/database'

export default defineEventHandler(async (event) => {
  const { organizationId } = await admin(event)
  const order = await getOrder(getRouterParam(event, 'id')!)
  if (order?.store_id !== organizationId) {
    throw createError({ statusCode: 404 })
  }
  if (!order) {
    throw createError({ statusCode: 404 })
  }
  if (order.snapshot.storeMode === 'sandbox') {
    if (!developmentSandboxEffectsEnabled()) {
      throw createError({ statusCode: 409, message: 'Development sandbox effects are disabled' })
    }
    const missingExpectedArtifacts = !order.client_id || (order.total !== 0 && !order.invoice_id)
    if (order.status === 'paid' && missingExpectedArtifacts) {
      // Older sandbox orders were deliberately marked complete/notified without
      // running post-payment effects. Make those orders eligible for processing.
      await rows("UPDATE products.orders SET processing='pending',notified=false,error=NULL WHERE id=$1", [order.id])
    }
    await processOrder(order.id)
    return { ok: true }
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
