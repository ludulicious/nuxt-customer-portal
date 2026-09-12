import { parseInput } from '@nuxt-customer-portal/products/server/utils/validation'
import { baseUrl, getStore, publicLimit } from '@nuxt-customer-portal/products/server/utils/access'
import { getOrder } from '@nuxt-customer-portal/products/server/utils/orders'
import { rows, transaction } from '@nuxt-customer-portal/products/server/utils/database'
import { checkoutReturnPath, hostThankYouUrl } from '@nuxt-customer-portal/products/server/utils/checkout-return'
import { z } from 'zod'

const scenarioSchema = z.object({ scenario: z.enum(['paid', 'failed', 'expired']) })

export default defineEventHandler(async (event) => {
  await publicLimit(event)
  if (getHeader(event, 'origin') !== baseUrl()) {
    throw createError({ statusCode: 403, message: 'Sandbox checkout must originate from the portal' })
  }
  const store = await getStore(true)
  const id = getRouterParam(event, 'id')!
  const input = parseInput(scenarioSchema, await readBody(event))
  if (store.mode !== 'sandbox') {
    throw createError({ statusCode: 404 })
  }
  await transaction(async (tx) => {
    await tx.query('SELECT id FROM products.orders WHERE id=$1 FOR UPDATE', [id])
    const order = await getOrder(id, tx)
    if (
      !order ||
      order.store_id !== store.organization_id ||
      order.checkout_id !== `sandbox:${id}` ||
      order.status !== 'pending'
    ) {
      throw createError({ statusCode: 409, message: 'This sandbox checkout is no longer pending' })
    }
    if (input.scenario === 'paid') {
      const total = order.lines.reduce((sum, line) => sum + line.unit_amount * line.quantity, 0)
      await rows(
        "UPDATE products.orders SET status='paid',payment_id=$2,total=$3,net=$3,tax=0,tax_details=$4,processing='complete',notified=true,updated_at=now() WHERE id=$1",
        [id, `sandbox:${id}`, total, { sandbox: true }],
        tx
      )
      for (const line of order.lines) {
        const lineTotal = line.unit_amount * line.quantity
        await rows(
          'UPDATE products.order_line SET total=$2,net=$2,tax=0,tax_details=$3 WHERE id=$1',
          [line.id, lineTotal, { sandbox: true }],
          tx
        )
      }
    } else {
      await rows(
        'UPDATE products.orders SET status=$2,processing=$2,updated_at=now() WHERE id=$1',
        [id, input.scenario],
        tx
      )
    }
  })
  const order = await getOrder(id)
  const line = order!.lines[0]!
  if (input.scenario === 'paid') {
    return {
      url:
        hostThankYouUrl({
          returnUrl: order!.snapshot.returnUrl,
          slug: line.snapshot.product.slug,
          locale: order!.snapshot.locale,
          currency: line.snapshot.price.currency,
          bookingReference: order!.booking_reference
        }) ||
        checkoutReturnPath({
          slug: line.snapshot.product.slug,
          locale: order!.snapshot.locale,
          currency: line.snapshot.price.currency,
          outcome: 'success',
          bookingReference: order!.booking_reference
        })
    }
  }
  return {
    url: checkoutReturnPath({
      slug: line.snapshot.product.slug,
      locale: order!.snapshot.locale,
      currency: line.snapshot.price.currency,
      outcome: input.scenario,
      returnUrl: order!.snapshot.returnUrl
    })
  }
})
