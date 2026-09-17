import { parseInput } from '@nuxt-customer-portal/products/server/utils/validation'
import { randomUUID } from 'node:crypto'
import { createError, type H3Event } from 'h3'
import { getSession, requireSession } from '@nuxt-customer-portal/core/server/portal'
import { requireAllowedClientType } from '@nuxt-customer-portal/clients/server/utils/client-configuration'
import { provisionPurchaseClient } from '@nuxt-customer-portal/clients/server/utils/purchase-client'
import { sendPortalEmail } from '@nuxt-customer-portal/core/server/utils/portal-email'
import { emailRecipientName } from '@nuxt-customer-portal/core/shared/email-recipient'
import type { Order, OrderLine, Price } from '../../shared/types'
import { checkoutSchema, hasRequiredPrices } from '../../shared/validation'
import { resolveCheckoutReturnUrl } from '../../shared/checkout-query'
import { checkoutReturnPath } from './checkout-return'
import { rows, transaction } from './database'
import { getStore, hash, baseUrl } from './access'
import { getProduct, selectCopy } from './catalog'
import { stripeProvider } from './payments'
import { orderIntegration, runOrderFulfillmentHooks, planningOrderIntegration } from './contracts'
import { developmentSandboxEffectsEnabled } from './development'

export async function getOrder(id: string, tx?: Parameters<typeof rows>[2]) {
  const [order] = await rows<Order>('SELECT * FROM products.orders WHERE id=$1', [id], tx)
  if (!order) {
    return undefined
  }
  order.lines = await rows('SELECT * FROM products.order_line WHERE order_id=$1 ORDER BY position', [id], tx)
  return order
}

export async function createCheckout(event: H3Event, body: unknown) {
  const input = parseInput(checkoutSchema, body),
    store = await getStore(true)
  input.returnUrl = resolveCheckoutReturnUrl(input.returnUrl, store.checkout_appearance.returnUrl)
  if (store.mode === 'live') {
    await orderIntegration().assertReady(store.organization_id)
  }
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
  const planningIntegration = planningOrderIntegration()
  const requestedProduct = await getProduct(store.organization_id, input.productId)
  if (requestedProduct.planning?.enabled && !planningIntegration) {
    throw createError({ statusCode: 503, message: 'Install planning before purchasing this service' })
  }
  if (planningIntegration && (requestedProduct.planning?.enabled || input.holdToken)) {
    await planningIntegration.prepareCheckout(event, input)
  }
  const fingerprint = hash(JSON.stringify({ ...input, buyerId }))
  const order = await transaction(async (tx) => {
    await tx.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`checkout:${input.requestId}`])
    const [existing] = await rows<Order & { request_hash: string }>(
      'SELECT * FROM products.orders WHERE request_id=$1',
      [input.requestId],
      tx
    )
    if (existing) {
      if (existing.request_hash !== fingerprint) {
        throw createError({ statusCode: 409, message: 'Checkout request has changed; start a new purchase' })
      }
      existing.lines = await rows(
        'SELECT * FROM products.order_line WHERE order_id=$1 ORDER BY position',
        [existing.id],
        tx
      )
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
    const snapshot = {
      billing: input.billing,
      locale: input.locale,
      returnUrl: input.returnUrl,
      storeMode: store.mode
    }
    const lineSnapshot = { product, title, price }
    const [created] = await rows<Order>(
      `INSERT INTO products.orders(id,store_id,request_id,request_hash,buyer_id,email,snapshot) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [id, store.organization_id, input.requestId, fingerprint, buyerId, input.billing.email, snapshot],
      tx
    )
    const [line] = await rows<OrderLine>(
      `INSERT INTO products.order_line(id,order_id,position,product_id,price_id,quantity,snapshot,unit_amount) VALUES($1,$2,0,$3,$4,1,$5,$6) RETURNING *`,
      [randomUUID(), id, product.id, price.id, lineSnapshot, price.amount],
      tx
    )
    created!.lines = [line!]
    if (product.planning?.enabled || input.holdToken) {
      if (!planningIntegration || !input.holdToken) {
        throw createError({ statusCode: 409, message: 'Choose an appointment before checkout' })
      }
      await planningIntegration.bind(event, tx, created!, input.holdToken)
    }
    return created!
  })
  const primaryLine = order.lines[0]!
  if (primaryLine.snapshot.product.isFree && primaryLine.snapshot.price.amount === 0) {
    const processSandboxEffects = store.mode === 'sandbox' && developmentSandboxEffectsEnabled()
    order.snapshot.paymentCompletedAt ||= new Date().toISOString()
    await rows('UPDATE products.orders SET snapshot=$2 WHERE id=$1', [order.id, order.snapshot])
    await rows(
      `UPDATE products.orders SET status='paid',total=0,net=0,tax=0,processing=$2,notified=$3 WHERE id=$1 AND status='pending'`,
      [
        order.id,
        store.mode === 'sandbox' && !processSandboxEffects ? 'complete' : 'pending',
        store.mode === 'sandbox' && !processSandboxEffects
      ]
    )
    await rows('UPDATE products.order_line SET total=0,net=0,tax=0 WHERE order_id=$1', [order.id])
    if (store.mode === 'live' || processSandboxEffects) {
      try {
        await processOrder(order.id)
      } catch {
        // Payment success is independent from retryable post-payment processing.
        // processOrder persists the error for the administrator.
      }
    }
    if (store.mode === 'sandbox' && !processSandboxEffects && order.snapshot.planningReservationId) {
      const current = await getOrder(order.id)
      await planningIntegration!.prepareOrder(current!)
      await transaction((tx) => planningIntegration!.confirm(tx, current!))
    }
    return {
      url: order.snapshot.planningChangeAppointmentId
        ? `${baseUrl()}/appointments/${order.snapshot.planningChangeAppointmentId}?payment=success`
        : `${baseUrl()}${checkoutReturnPath({
            slug: primaryLine.snapshot.product.slug,
            locale: order.snapshot.locale,
            currency: primaryLine.snapshot.price.currency,
            outcome: 'success',
            returnUrl: order.snapshot.returnUrl,
            bookingReference: order.booking_reference
          })}`
    }
  }
  if (order.status !== 'pending') {
    throw createError({ statusCode: 409, message: 'This checkout is already completed or expired' })
  }
  if (store.mode === 'sandbox') {
    const checkoutId = `sandbox:${order.id}`
    await rows('UPDATE products.orders SET checkout_id=$2 WHERE id=$1', [order.id, checkoutId])
    return { url: `${baseUrl()}/store/sandbox-checkout/${order.id}` }
  }
  const checkout = await stripeProvider.checkout(order)
  const saved = await rows<{ id: string }>(
    "UPDATE products.orders SET checkout_id=$2 WHERE id=$1 AND status='pending' RETURNING id",
    [order.id, checkout.id]
  )
  if (
    order.snapshot.planningReservationId &&
    (!saved.length || Date.parse(order.snapshot.planningExpiresAt!) <= Date.now())
  ) {
    await stripeProvider.expireCheckout(checkout.id)
    throw createError({ statusCode: 409, message: 'Reservation expired; choose another slot' })
  }
  return { url: checkout.url }
}
export { hasPurchaseAccess as hasAccess } from '../../shared/access'
export async function claimPurchases(event: H3Event) {
  const session = await requireSession(event)
  if (!session.user.emailVerified || !session.user.email) {
    throw createError({ statusCode: 403, message: 'Verify your email before accessing purchases' })
  }
  await rows(`UPDATE products.orders SET buyer_id=$1 WHERE buyer_id IS NULL AND email=$2 AND status='paid'`, [
    session.user.id,
    session.user.email.toLowerCase()
  ])
  return session.user.id
}
export async function processOrder(id: string) {
  const store = await getStore()
  try {
    const current = await getOrder(id)
    if (current?.status === 'paid' && current.snapshot.planningReservationId) {
      if (!planningOrderIntegration()) {
        throw new Error('Planning package required to process this appointment')
      }
      await planningOrderIntegration()!.prepareOrder(current)
    }
    await transaction(async (tx) => {
      const pending = await getOrder(id, tx)
      if (pending?.status === 'paid' && pending.snapshot.planningReservationId) {
        await planningOrderIntegration()!.confirm(tx, pending)
      }
      await tx.query('SELECT id FROM products.orders WHERE id=$1 FOR UPDATE', [id])
      const order = await getOrder(id, tx)
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
        await tx.query('UPDATE products.orders SET client_id=$2,invitation_id=$3 WHERE id=$1', [
          id,
          order.client_id,
          order.invitation_id
        ])
      }
      if (!order.invoice_id && order.total !== 0) {
        order.invoice_id = await orderIntegration().invoice(tx, order, store.actor_id)
        await tx.query('UPDATE products.orders SET invoice_id=$2 WHERE id=$1', [id, order.invoice_id])
      }
      await orderIntegration().refund(tx, order, store.actor_id)
      if (order.processing !== 'complete') {
        await runOrderFulfillmentHooks(tx, order)
      }
      await tx.query("UPDATE products.orders SET processing='complete',error=NULL WHERE id=$1", [id])
    })
    await notifyOrder(id)
  } catch (error) {
    await rows("UPDATE products.orders SET processing='failed',error=$2 WHERE id=$1", [
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
      body: 'Dear {{recipient_name}},\n\nThank you for your purchase of **{{product}}**. We are pleased to confirm that your order has been completed successfully.\n\n- **Booking reference:** {{bookingReference}}\n\n{{instructions}}\n\nYou can find your purchase details and any available materials in [your portal]({{url}}).',
      footer: 'Please keep this email for your records. We hope you enjoy your purchase.'
    },
    nl: {
      subject: 'Je aankoop: {{product}}',
      body: 'Beste {{recipient_name}},\n\nBedankt voor je aankoop van **{{product}}**. We bevestigen graag dat je bestelling succesvol is afgerond.\n\n- **Boekingsnummer:** {{bookingReference}}\n\n{{instructions}}\n\nJe vindt de gegevens van je aankoop en eventuele beschikbare materialen in [je portaal]({{url}}).',
      footer: 'Bewaar deze e-mail voor je administratie. We wensen je veel plezier met je aankoop.'
    }
  },
  placeholders: [
    { key: 'recipient_name', labelKey: 'admin.email.placeholders.recipientName', example: 'Alex' },
    { key: 'product', labelKey: 'products.title', example: 'Audio' },
    { key: 'bookingReference', labelKey: 'products.bookingReference', example: 'BK-7F3A9C12D4E8' },
    { key: 'instructions', labelKey: 'products.nextSteps', example: 'Welcome' },
    { key: 'url', labelKey: 'products.purchases', example: 'https://example.com/purchases' }
  ]
}
async function notifyOrder(id: string) {
  const order = await getOrder(id)
  if (!order || order.status !== 'paid' || order.notified) {
    return
  }
  const store = await getStore()
  const url = order.invitation_id
    ? `${baseUrl()}/signup?invitationId=${encodeURIComponent(order.invitation_id)}`
    : `${baseUrl()}/purchases`
  // Invoice delivery persists its own claim, and the purchase email uses a
  // provider idempotency key. Do not hold an order transaction over PDF and
  // external email work.
  await orderIntegration().notify(order, store.actor_id)
  if (
    order.snapshot.planningReservationId ||
    order.snapshot.planningFailure ||
    order.snapshot.planningChangeAppointmentId
  ) {
    await rows('UPDATE products.orders SET notified=true,error=NULL WHERE id=$1', [id])
    return
  }
  const primaryLine = order.lines[0]!
  await sendPortalEmail({
    moduleId: 'products',
    definition: purchaseEmail,
    locale: order.snapshot.locale,
    to: order.email,
    values: {
      recipient_name: emailRecipientName({
        firstName: order.snapshot.billing.firstName,
        displayName: order.snapshot.billing.name,
        email: order.email
      }),
      product: order.lines.map((line) => line.snapshot.title).join(', '),
      bookingReference: order.booking_reference,
      url,
      instructions: primaryLine.snapshot.product.nextSteps[order.snapshot.locale]
    },
    idempotencyKey: `purchase:${id}`,
    subjectPrefix: order.snapshot.storeMode === 'sandbox' ? '[TEST] ' : undefined
  })
  await rows('UPDATE products.orders SET notified=true,error=NULL WHERE id=$1 AND notified=false', [id])
}
export async function reconcileCheckout(checkoutId: string, paymentCompletedAt?: string) {
  const checkout = await stripeProvider.lookupCheckout(checkoutId)
  const id = checkout.metadata?.orderId
  if (!id) {
    return
  }
  const order = await getOrder(id)
  if (!order || (order.checkout_id && order.checkout_id !== checkout.id)) {
    return
  }
  if (
    checkout.currency?.toUpperCase() !== order.lines[0]?.snapshot.price.currency ||
    checkout.client_reference_id !== id
  ) {
    throw new Error('Checkout identity mismatch')
  }
  if (checkout.payment_status === 'paid') {
    const total = checkout.amount_total!,
      tax = checkout.total_details?.amount_tax || 0
    const checkoutLines = checkout.line_items?.data ?? []
    if (
      checkoutLines.length !== order.lines.length ||
      checkoutLines.some(
        (line, index) =>
          line.quantity !== order.lines[index]!.quantity || line.price?.unit_amount !== order.lines[index]!.unit_amount
      )
    ) {
      throw new Error('Checkout price mismatch')
    }
    const paymentId =
      typeof checkout.payment_intent === 'string' ? checkout.payment_intent : checkout.payment_intent?.id
    if (!paymentId) {
      throw new Error('Paid checkout has no payment reference')
    }
    const paymentState = await stripeProvider.lookupPayment(paymentId)
    if (order.snapshot.planningReservationId && !order.snapshot.paymentCompletedAt) {
      order.snapshot.paymentCompletedAt =
        paymentCompletedAt || (await stripeProvider.paymentCompletedAt(paymentId, order.created_at))
    }
    await transaction(async (tx) => {
      await tx.query('SELECT id FROM products.orders WHERE id=$1 FOR UPDATE', [id])
      if (order.snapshot.planningReservationId) {
        await tx.query('UPDATE products.orders SET snapshot=$2 WHERE id=$1', [id, order.snapshot])
      }
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
        await tx.query('UPDATE products.orders SET snapshot=$2 WHERE id=$1 AND invoice_id IS NULL', [
          id,
          order.snapshot
        ])
      }
      await tx.query(
        `UPDATE products.orders SET status='paid',checkout_id=$2,payment_id=$3,total=$4,net=$5,tax=$6,tax_details=$7,refunded=GREATEST(refunded,$8),disputed=$9,updated_at=now() WHERE id=$1`,
        [
          id,
          checkout.id,
          paymentId,
          total,
          total - tax,
          tax,
          JSON.stringify({
            taxes: checkoutLines.flatMap((line) => line.taxes || []),
            taxIds: checkout.customer_details?.tax_ids || [],
            address: checkout.customer_details?.address,
            taxExempt: checkout.customer_details?.tax_exempt
          }),
          paymentState.refunded,
          paymentState.disputed
        ]
      )
      for (const [index, line] of checkoutLines.entries()) {
        const lineTax = (line.taxes || []).reduce((sum, item) => sum + (item.amount || 0), 0)
        const lineTotal = line.amount_total
        await tx.query(
          'UPDATE products.order_line SET total=$2,net=$3,tax=$4,tax_details=$5,refunded=GREATEST(refunded,$6) WHERE id=$1',
          [
            order.lines[index]!.id,
            lineTotal,
            lineTotal - lineTax,
            lineTax,
            JSON.stringify({ taxes: line.taxes || [] }),
            order.lines.length === 1 ? paymentState.refunded : order.lines[index]!.refunded
          ]
        )
      }
    })
    await processOrder(id)
  } else if (checkout.status === 'expired') {
    await rows("UPDATE products.orders SET status='expired' WHERE id=$1 AND status='pending'", [id])
  }
  return id
}
