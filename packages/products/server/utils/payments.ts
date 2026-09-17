import Stripe from 'stripe'
import { createHash } from 'node:crypto'
import { createError } from 'h3'
import type { Order } from '../../shared/types'
import { baseUrl } from './access'
import { checkoutReturnPath, hostThankYouUrl } from './checkout-return'
import { resolveStripeConfiguration } from './stripe-configuration'

export const stripeClient = async () => {
  const config = await resolveStripeConfiguration()
  return new Stripe(config.secretKey)
}
export interface PaymentProvider {
  paymentCompletedAt(id: string, since: string): Promise<string>
  refund(id: string, amount: number, key: string): Promise<void>
  expireCheckout(id: string): Promise<void>
  lookupPayment(id: string): Promise<{ refunded: number; disputed: boolean }>
  lookupCheckout(id: string): Promise<Stripe.Checkout.Session>
  checkout(order: Order): Promise<{ id: string; url: string | null }>
  verify(body: string, signature: string): Promise<Stripe.Event>
}
export const stripeProvider: PaymentProvider = {
  async paymentCompletedAt(id, since) {
    // Reconciliation needs authoritative success time, rather than webhook arrival time.
    let cursor: string | undefined
    do {
      const events = await (
        await stripeClient()
      ).events.list({
        type: 'payment_intent.succeeded',
        created: { gte: Math.floor(Date.parse(since) / 1000) },
        limit: 100,
        ...(cursor ? { starting_after: cursor } : {})
      })
      const found = events.data.find((e) => (e.data.object as Stripe.PaymentIntent).id === id)
      if (found) {
        return new Date(found.created * 1000).toISOString()
      }
      if (!events.has_more) {
        break
      }
      cursor = events.data.at(-1)!.id
    } while (cursor)
    throw new Error('Awaiting authoritative payment completion time')
  },
  async refund(id, amount, key) {
    const stripe = await stripeClient(),
      identity = createHash('sha256').update(key).digest('hex')
    let cursor: string | undefined, existing: Stripe.Refund | undefined
    do {
      const page = await stripe.refunds.list({
        payment_intent: id,
        limit: 100,
        ...(cursor ? { starting_after: cursor } : {})
      })
      existing = page.data.find((refund) => refund.metadata?.planningRefundKey === identity)
      if (existing || !page.has_more) {
        break
      }
      cursor = page.data.at(-1)!.id
    } while (cursor)
    const refund =
      existing ||
      (await stripe.refunds.create(
        { payment_intent: id, amount, metadata: { planningRefundKey: identity } },
        { idempotencyKey: key }
      ))
    if (refund.status !== 'succeeded') {
      throw new Error(`Refund ${refund.status}; awaiting settlement or staff review`)
    }
  },
  async expireCheckout(id) {
    const stripe = await stripeClient()
    const session = await stripe.checkout.sessions.retrieve(id)
    if (session.status === 'open') {
      await stripe.checkout.sessions.expire(id)
    }
  },
  async lookupPayment(id) {
    const stripe = await stripeClient()
    const payment = await stripe.paymentIntents.retrieve(id, { expand: ['latest_charge'] })
    const charge = payment.latest_charge as Stripe.Charge | null
    const disputes = await stripe.disputes.list({ payment_intent: id, limit: 100 })
    return {
      refunded: charge?.amount_refunded ?? 0,
      disputed: disputes.data.some((dispute) => !['won', 'warning_closed'].includes(dispute.status))
    }
  },
  lookupCheckout: async (id) =>
    (await stripeClient()).checkout.sessions.retrieve(id, { expand: ['line_items.data.taxes.rate'] }),
  async checkout(order) {
    const primaryLine = order.lines[0]!
    const successUrl =
      (order.snapshot.planningChangeAppointmentId
        ? `${baseUrl()}/appointments/${order.snapshot.planningChangeAppointmentId}?payment=success`
        : undefined) ||
      hostThankYouUrl({
        returnUrl: order.snapshot.returnUrl,
        slug: primaryLine.snapshot.product.slug,
        locale: order.snapshot.locale,
        currency: primaryLine.snapshot.price.currency,
        bookingReference: order.booking_reference
      }) ||
      `${baseUrl()}${checkoutReturnPath({
        slug: primaryLine.snapshot.product.slug,
        locale: order.snapshot.locale,
        currency: primaryLine.snapshot.price.currency,
        outcome: 'success',
        bookingReference: order.booking_reference
      })}`
    return (await stripeClient()).checkout.sessions.create(
      {
        mode: 'payment',
        ...(order.snapshot.planningReservationId
          ? {
              payment_method_types: ['card'] as Stripe.Checkout.SessionCreateParams.PaymentMethodType[],
              expires_at: Math.max(
                Math.floor(Date.now() / 1000) + 1800,
                Math.floor(Date.parse(order.snapshot.planningExpiresAt!) / 1000)
              )
            }
          : {}),
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
        success_url: successUrl,
        cancel_url: order.snapshot.planningChangeAppointmentId
          ? `${baseUrl()}/appointments/${order.snapshot.planningChangeAppointmentId}?payment=cancelled`
          : `${baseUrl()}${checkoutReturnPath({
              slug: primaryLine.snapshot.product.slug,
              locale: order.snapshot.locale,
              currency: primaryLine.snapshot.price.currency,
              outcome: 'cancelled',
              returnUrl: order.snapshot.returnUrl
            })}`
      },
      { idempotencyKey: `products:${order.id}` }
    )
  },
  async verify(body, signature) {
    const config = await resolveStripeConfiguration()
    if (!config.webhookSecret) {
      throw createError({ statusCode: 503, message: 'Configure Stripe webhook signing' })
    }
    return (await stripeClient()).webhooks.constructEvent(body, signature, config.webhookSecret)
  }
}
