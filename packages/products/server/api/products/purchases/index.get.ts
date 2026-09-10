import { claimPurchases, hasAccess } from '@nuxt-customer-portal/products/server/utils/orders'
import { rows } from '@nuxt-customer-portal/products/server/utils/database'
import type { Order } from '@nuxt-customer-portal/products/shared/types'

export default defineEventHandler(async (event) => {
  const userId = await claimPurchases(event)
  setHeader(event, 'Cache-Control', 'no-store')
  const orders = await rows<Order>(
    `SELECT * FROM products.purchase WHERE buyer_id=$1 AND status='paid' ORDER BY created_at DESC`,
    [userId]
  )
  return orders.map((o) => ({
    id: o.id,
    title: o.snapshot.title,
    locale: o.snapshot.locale,
    type: o.snapshot.product.type,
    amount: o.total,
    currency: o.snapshot.price.currency,
    access: hasAccess(o),
    refunded: o.refunded,
    disputed: o.disputed,
    fulfilled: o.fulfilled,
    invoiceId: o.invoice_id,
    nextSteps: o.snapshot.product.nextSteps[o.snapshot.locale],
    fileIds: hasAccess(o) ? o.snapshot.product.fileIds : [],
    createdAt: o.created_at
  }))
})
