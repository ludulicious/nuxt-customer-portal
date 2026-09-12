import Stripe from 'stripe'
import { createError } from 'h3'
import type { Order } from '../../shared/types'
import { baseUrl } from './access'

export const stripeClient = () => {
  const secret = process.env.PRODUCTS_STRIPE_SECRET_KEY
  if (!secret) {
    throw createError({ statusCode: 503, message: 'Configure Stripe before opening checkout' })
  }
  return new Stripe(secret)
}
export interface PaymentProvider {
  lookupPayment(id: string): Promise<{ refunded: number; disputed: boolean }>
  lookupCheckout(id: string): Promise<Stripe.Checkout.Session>
  checkout(order: Order): Promise<{ id: string; url: string | null }>
  verify(body: string, signature: string): Stripe.Event
}
export const stripeProvider: PaymentProvider = {
  async lookupPayment(id) {
    const stripe = stripeClient()
    const payment = await stripe.paymentIntents.retrieve(id, { expand: ['latest_charge'] })
    const charge = payment.latest_charge as Stripe.Charge | null
    const disputes = await stripe.disputes.list({ payment_intent: id, limit: 100 })
    return {
      refunded: charge?.amount_refunded ?? 0,
      disputed: disputes.data.some((dispute) => !['won', 'warning_closed'].includes(dispute.status))
    }
  },
  lookupCheckout: (id) => stripeClient().checkout.sessions.retrieve(id, { expand: ['line_items.data.taxes.rate'] }),
  async checkout(order) {
    const primaryLine = order.lines[0]!
    return stripeClient().checkout.sessions.create(
      {
        mode: 'payment',
        customer_email: order.email,
        client_reference_id: order.id,
        metadata: { orderId: order.id },
        payment_intent_data: { metadata: { orderId: order.id } },
        line_items: order.lines.map((line) => {
          const p = line.snapshot.price
          return {
            quantity: line.quantity,
            price_data: {
              currency: p.currency.toLowerCase(),
              unit_amount: p.amount,
              tax_behavior: p.taxBehavior,
              product_data: { name: line.snapshot.title, tax_code: line.snapshot.product.taxCode }
            }
          }
        }),
        automatic_tax: { enabled: true },
        billing_address_collection: 'required',
        tax_id_collection: { enabled: order.snapshot.billing.type === 'organization' },
        invoice_creation: { enabled: false },
        locale: order.snapshot.locale,
        success_url: `${baseUrl()}/store/complete`,
        cancel_url: `${baseUrl()}/store/${primaryLine.snapshot.product.slug}`
      },
      { idempotencyKey: `products:${order.id}` }
    )
  },
  verify(body, signature) {
    const secret = process.env.PRODUCTS_STRIPE_WEBHOOK_SECRET
    if (!secret) {
      throw createError({ statusCode: 503, message: 'Configure Stripe webhook signing' })
    }
    return stripeClient().webhooks.constructEvent(body, signature, secret)
  }
}
