import { parseInput } from '@nuxt-customer-portal/products/server/utils/validation'
import { randomUUID } from 'node:crypto'
import { createError, type H3Event } from 'h3'
import { getSession, requireSession } from '@nuxt-customer-portal/core/server/portal'
import { requireAllowedClientType } from '@nuxt-customer-portal/clients/server/utils/client-configuration'
import { provisionPurchaseClient } from '@nuxt-customer-portal/clients/server/utils/purchase-client'
import { sendPortalEmail } from '@nuxt-customer-portal/core/server/utils/portal-email'
import type { Order, Price } from '../../shared/types'
import { checkoutSchema, hasRequiredPrices } from '../../shared/validation'
import { rows, transaction } from './database'
import { getStore, hash, baseUrl } from './access'
import { getProduct, selectCopy } from './catalog'
import { stripeProvider } from './payments'
import { purchaseIntegration, runPurchaseFulfillmentHooks } from './contracts'

export async function createCheckout(event: H3Event, body: unknown) {
  const input = parseInput(checkoutSchema, body),
    store = await getStore(true)
  await purchaseIntegration().assertReady(store.organization_id)
  await requireAllowedClientType(input.billing.type)
  const session = await getSession(event)
  const buyerId =
    session?.user.emailVerified && session.user.email?.toLowerCase() === input.billing.email ? session.user.id : null
  if (input.billing.clientId) {
    if (!buyerId) {
      throw createError({ statusCode: 403, message: 'Sign in before selecting an existing business' })
    }
    const [member] = await rows<{ id: string }>(
      `SELECT p.organization_id AS id FROM clients.client_profile p JOIN public.member m ON m.organization_id=p.organization_id WHERE m.user_id=$1 AND p.organization_id=$2 AND p.client_type=$3 AND p.archived_at IS NULL`,
      [buyerId, input.billing.clientId, input.billing.type]
    )
    if (!member) {
      throw createError({ statusCode: 403, message: 'Client membership required' })
    }
  }
  const fingerprint = hash(JSON.stringify({ ...input, buyerId }))
  const order = await transaction(async (tx) => {
    await tx.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`checkout:${input.requestId}`])
    const [existing] = await rows<Order & { request_hash: string }>(
      'SELECT * FROM products.purchase WHERE request_id=$1',
      [input.requestId],
      tx
    )
    if (existing) {
      if (existing.request_hash !== fingerprint) {
        throw createError({ statusCode: 409, message: 'Checkout request has changed; start a new purchase' })
      }
      return existing
    }
    const [currentStore] = await rows<{ currencies: string[] }>(
      'SELECT currencies FROM products.store WHERE id=true FOR SHARE',
      [],
      tx
    )
    await tx.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`product:${input.productId}`])
    const product = await getProduct(store.organization_id, input.productId)
    if (product.status !== 'published') {
      throw createError({ statusCode: 404, message: 'Product is not available' })
    }
    if (!hasRequiredPrices(product, currentStore!.currencies)) {
      throw createError({ statusCode: 409, message: 'Product pricing is incomplete' })
    }
    const price: Price | undefined = product.prices.find((p) => p.id === input.priceId)
    if (!price || (!product.isFree && !currentStore!.currencies.includes(price.currency))) {
      throw createError({ statusCode: 409, message: 'Price has changed; refresh the product' })
    }
    const id = randomUUID(),
      title = selectCopy(product, input.locale, store.default_locale).title
    const snapshot = { product, title, price, billing: input.billing, locale: input.locale }
    const [created] = await rows<Order>(
      `INSERT INTO products.purchase(id,store_id,product_id,price_id,request_id,request_hash,buyer_id,email,snapshot) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [
        id,
        store.organization_id,
        product.id,
        price.id,
        input.requestId,
        fingerprint,
        buyerId,
        input.billing.email,
        snapshot
      ],
      tx
    )
    return created!
  })
  if (order.snapshot.product.isFree && order.snapshot.price.amount === 0) {
    await rows("UPDATE products.purchase SET status='paid',total=0,net=0,tax=0 WHERE id=$1 AND status='pending'", [
      order.id
    ])
    await processOrder(order.id)
    return { url: `${baseUrl()}/purchases` }
  }
  if (order.status !== 'pending') {
    throw createError({ statusCode: 409, message: 'This checkout is already completed or expired' })
  }
  const checkout = await stripeProvider.checkout(order)
  await rows('UPDATE products.purchase SET checkout_id=$2 WHERE id=$1', [order.id, checkout.id])
  return { url: checkout.url }
}
export { hasPurchaseAccess as hasAccess } from '../../shared/access'
export async function claimPurchases(event: H3Event) {
  const session = await requireSession(event)
  if (!session.user.emailVerified || !session.user.email) {
    throw createError({ statusCode: 403, message: 'Verify your email before accessing purchases' })
  }
  await rows(`UPDATE products.purchase SET buyer_id=$1 WHERE buyer_id IS NULL AND email=$2 AND status='paid'`, [
    session.user.id,
    session.user.email.toLowerCase()
  ])
  return session.user.id
}
export async function processOrder(id: string) {
  const store = await getStore()
  try {
    await transaction(async (tx) => {
      const [order] = await rows<Order>('SELECT * FROM products.purchase WHERE id=$1 FOR UPDATE', [id], tx)
      if (!order || order.status !== 'paid') {
        return
      }
      if (!order.client_id) {
        const linked = await provisionPurchaseClient(
          tx,
          order.snapshot.billing,
          order.buyer_id,
          store.actor_id,
          order.snapshot.locale
        )
        order.client_id = linked.clientId
        order.invitation_id = linked.invitationId
        await tx.query('UPDATE products.purchase SET client_id=$2,invitation_id=$3 WHERE id=$1', [
          id,
          order.client_id,
          order.invitation_id
        ])
      }
      if (!order.invoice_id && order.total !== 0) {
        order.invoice_id = await purchaseIntegration().invoice(tx, order, store.actor_id)
        await tx.query('UPDATE products.purchase SET invoice_id=$2 WHERE id=$1', [id, order.invoice_id])
      }
      await purchaseIntegration().refund(tx, order, store.actor_id)
      if (order.processing !== 'complete') {
        await runPurchaseFulfillmentHooks(tx, order)
      }
      await tx.query("UPDATE products.purchase SET processing='complete',error=NULL WHERE id=$1", [id])
    })
    await notifyOrder(id)
  } catch (error) {
    await rows("UPDATE products.purchase SET processing='failed',error=$2 WHERE id=$1", [
      id,
      error instanceof Error ? error.message : 'Processing failed'
    ])
    throw error
  }
}
const purchaseEmail = {
  id: 'purchase',
  labelKey: 'products.purchases',
  defaults: {
    en: {
      subject: 'Your purchase: {{product}}',
      body: 'Thank you for your purchase of {{product}}. {{instructions}}<br><a href="{{url}}">Open your portal</a>'
    },
    nl: {
      subject: 'Je aankoop: {{product}}',
      body: 'Bedankt voor je aankoop van {{product}}. {{instructions}}<br><a href="{{url}}">Open je portaal</a>'
    }
  },
  placeholders: [
    { key: 'product', labelKey: 'products.title', example: 'Audio' },
    { key: 'instructions', labelKey: 'products.nextSteps', example: 'Welcome' },
    { key: 'url', labelKey: 'products.purchases', example: 'https://example.com/purchases' }
  ]
}
async function notifyOrder(id: string) {
  // Serialize delivery attempts. Provider idempotency protects the send/commit crash boundary.
  await transaction(async (tx) => {
    const [order] = await rows<Order>('SELECT * FROM products.purchase WHERE id=$1 FOR UPDATE', [id], tx)
    if (!order || order.status !== 'paid' || order.notified) {
      return
    }
    const store = await getStore()
    const url = order.invitation_id
      ? `${baseUrl()}/signup?invitationId=${encodeURIComponent(order.invitation_id)}`
      : `${baseUrl()}/purchases`
    await purchaseIntegration().notify(order, store.actor_id)
    await sendPortalEmail({
      moduleId: 'products',
      definition: purchaseEmail,
      locale: order.snapshot.locale,
      to: order.email,
      values: {
        product: order.snapshot.title,
        url,
        instructions: order.snapshot.product.nextSteps[order.snapshot.locale]
      },
      idempotencyKey: `purchase:${id}`
    })
    await tx.query('UPDATE products.purchase SET notified=true,error=NULL WHERE id=$1', [id])
  })
}
export async function reconcileCheckout(checkoutId: string) {
  const checkout = await stripeProvider.lookupCheckout(checkoutId)
  const id = checkout.metadata?.orderId
  if (!id) {
    return
  }
  const [order] = await rows<Order>('SELECT * FROM products.purchase WHERE id=$1', [id])
  if (!order || (order.checkout_id && order.checkout_id !== checkout.id)) {
    return
  }
  if (checkout.currency?.toUpperCase() !== order.snapshot.price.currency || checkout.client_reference_id !== id) {
    throw new Error('Checkout identity mismatch')
  }
  if (checkout.payment_status === 'paid') {
    const total = checkout.amount_total!,
      tax = checkout.total_details?.amount_tax || 0
    const line = checkout.line_items?.data[0]
    if (
      !line ||
      line.quantity !== 1 ||
      checkout.line_items?.data.length !== 1 ||
      line.price?.unit_amount !== order.snapshot.price.amount
    ) {
      throw new Error('Checkout price mismatch')
    }
    const paymentId =
      typeof checkout.payment_intent === 'string' ? checkout.payment_intent : checkout.payment_intent?.id
    if (!paymentId) {
      throw new Error('Paid checkout has no payment reference')
    }
    await transaction(async (tx) => {
      await tx.query('SELECT id FROM products.purchase WHERE id=$1 FOR UPDATE', [id])
      const paymentState = await stripeProvider.lookupPayment(paymentId)
      const address = checkout.customer_details?.address
      if (address && !order.invoice_id) {
        order.snapshot.billing.address = [
          address.line1,
          address.line2,
          address.postal_code,
          address.city,
          address.state,
          address.country
        ]
          .filter(Boolean)
          .join(', ')
        order.snapshot.billing.country = address.country || order.snapshot.billing.country
        order.snapshot.billing.vatNumber = checkout.customer_details?.tax_ids?.[0]?.value || ''
        await tx.query('UPDATE products.purchase SET snapshot=$2 WHERE id=$1 AND invoice_id IS NULL', [
          id,
          order.snapshot
        ])
      }
      await tx.query(
        `UPDATE products.purchase SET status='paid',checkout_id=$2,payment_id=$3,total=$4,net=$5,tax=$6,tax_details=$7,refunded=GREATEST(refunded,$8),disputed=$9,updated_at=now() WHERE id=$1`,
        [
          id,
          checkout.id,
          paymentId,
          total,
          total - tax,
          tax,
          JSON.stringify({
            taxes: line.taxes || [],
            taxIds: checkout.customer_details?.tax_ids || [],
            address: checkout.customer_details?.address,
            taxExempt: checkout.customer_details?.tax_exempt
          }),
          paymentState.refunded,
          paymentState.disputed
        ]
      )
    })
    await processOrder(id)
  } else if (checkout.status === 'expired') {
    await rows("UPDATE products.purchase SET status='expired' WHERE id=$1 AND status='pending'", [id])
  }
  return id
}
