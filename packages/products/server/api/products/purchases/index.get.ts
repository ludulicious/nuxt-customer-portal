import { claimPurchases, hasAccess, getOrder } from '@nuxt-customer-portal/products/server/utils/orders'
import { rows } from '@nuxt-customer-portal/products/server/utils/database'
import type { Order } from '@nuxt-customer-portal/products/shared/types'

export default defineEventHandler(async (event) => {
  const userId = await claimPurchases(event)
  setHeader(event, 'Cache-Control', 'no-store')
  const records = await rows<Order>(
    `SELECT * FROM products.orders WHERE buyer_id=$1 AND status='paid' ORDER BY created_at DESC`,
    [userId]
  )
  const orders = (await Promise.all(records.map((record) => getOrder(record.id)))).filter(Boolean) as Order[]
  return orders.flatMap((o) =>
    o.lines.map((line) => ({
      id: line.id,
      orderId: o.id,
      title: line.snapshot.title,
      locale: o.snapshot.locale,
      type: line.snapshot.product.type,
      amount: line.total ?? line.unit_amount * line.quantity,
      currency: line.snapshot.price.currency,
      access: hasAccess(o, line),
      refunded: line.refunded,
      disputed: o.disputed,
      fulfilled: line.fulfilled,
      invoiceId: o.invoice_id,
      nextSteps: line.snapshot.product.nextSteps[o.snapshot.locale],
      fileIds: hasAccess(o, line) ? line.snapshot.product.fileIds : [],
      createdAt: o.created_at
    }))
  )
})
