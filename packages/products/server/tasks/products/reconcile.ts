import { rows } from '../../utils/database'
import { reconcileCheckout, processOrder } from '../../utils/orders'
import { handleWebhook } from '../../utils/webhooks'
import { stripeClient } from '../../utils/payments'
import type { Order } from '../../../shared/types'
import { cleanupOrphanedAssets } from '../../utils/storage'

export default defineTask({
  meta: { name: 'products:reconcile', description: 'Retry unfinished purchases and failed payment notifications' },
  async run() {
    const paymentsConfigured = !!process.env.PRODUCTS_STRIPE_SECRET_KEY
    const orders = await rows<Order>(
      `SELECT * FROM products.orders WHERE (status='paid' AND (processing<>'complete' OR NOT notified)) OR (status='pending' AND checkout_id IS NOT NULL AND created_at<now()-interval '1 minute') ORDER BY updated_at LIMIT 20`
    )
    let processed = 0,
      failed = 0
    for (const order of orders) {
      try {
        if (order.status === 'pending') {
          if (!paymentsConfigured) {
            continue
          }
          await reconcileCheckout(order.checkout_id!)
        } else {
          await processOrder(order.id)
        }
        processed++
      } catch {
        failed++
      } finally {
        await rows('UPDATE products.orders SET updated_at=now() WHERE id=$1', [order.id])
      }
    }
    const events = await rows<{ id: string }>(
      'SELECT id FROM products.webhook WHERE processed_at IS NULL ORDER BY created_at LIMIT 20'
    )
    for (const event of paymentsConfigured ? events : []) {
      try {
        await handleWebhook(await stripeClient().events.retrieve(event.id))
      } catch {
        failed++
      }
    }
    await rows('DELETE FROM products.rate_limit WHERE bucket_minute<$1', [Math.floor(Date.now() / 60000) - 60])
    await cleanupOrphanedAssets().catch(() => 0)
    return { result: { processed, failed } }
  }
})
