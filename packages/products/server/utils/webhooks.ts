import type Stripe from 'stripe'
import { rows, transaction } from './database'
import { stripeProvider } from './payments'
import { getOrder, reconcileCheckout, processOrder } from './orders'
import type { Order } from '../../shared/types'

export async function reconcilePayment(paymentId: string) {
  const [record] = await rows<Order>('SELECT * FROM products.orders WHERE payment_id=$1', [paymentId])
  const order = record ? await getOrder(record.id) : undefined
  if (!order) {
    return
  }
  await transaction(async (tx) => {
    await tx.query('SELECT id FROM products.orders WHERE id=$1 FOR UPDATE', [order.id])
    const state = await stripeProvider.lookupPayment(paymentId)
    await tx.query('UPDATE products.orders SET refunded=$2,disputed=$3,updated_at=now() WHERE id=$1', [
      order.id,
      state.refunded,
      state.disputed
    ])
    if (order.lines.length === 1) {
      await tx.query('UPDATE products.order_line SET refunded=$2 WHERE id=$1', [order.lines[0]!.id, state.refunded])
    }
  })
  await processOrder(order.id)
  return order.id
}
export async function handleWebhook(event: Stripe.Event) {
  await rows('INSERT INTO products.webhook(id,type) VALUES($1,$2) ON CONFLICT DO NOTHING', [event.id, event.type])
  const [record] = await rows<{ processed_at: string | null }>(
    'SELECT processed_at FROM products.webhook WHERE id=$1',
    [event.id]
  )
  if (record?.processed_at) {
    return
  }
  try {
    let id: string | undefined
    if (
      ['checkout.session.completed', 'checkout.session.async_payment_succeeded', 'checkout.session.expired'].includes(
        event.type
      )
    ) {
      id = await reconcileCheckout((event.data.object as Stripe.Checkout.Session).id)
    }
    if (event.type === 'checkout.session.async_payment_failed') {
      const session = event.data.object as Stripe.Checkout.Session
      await rows("UPDATE products.orders SET status='failed' WHERE checkout_id=$1 AND status='pending'", [session.id])
    }
    if (event.type === 'charge.refunded' || event.type.startsWith('charge.dispute.')) {
      const object = event.data.object as Stripe.Charge | Stripe.Dispute
      const paymentId = typeof object.payment_intent === 'string' ? object.payment_intent : object.payment_intent?.id
      if (paymentId) {
        id = await reconcilePayment(paymentId)
      }
    }
    await rows('UPDATE products.webhook SET processed_at=now(),order_id=$2,error=NULL WHERE id=$1', [
      event.id,
      id || null
    ])
  } catch (error) {
    await rows('UPDATE products.webhook SET error=$2 WHERE id=$1', [
      event.id,
      error instanceof Error ? error.message : 'Webhook failed'
    ])
    throw error
  }
}
