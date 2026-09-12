import { registerOrderIntegration } from '@nuxt-customer-portal/products/server/utils/contracts'
import {
  assertCommerceInvoicesReady,
  createCommerceDocument
} from '@nuxt-customer-portal/invoices/server/utils/commerce'
import { getInvoiceEmailPreview, deliverInvoiceEmail } from '@nuxt-customer-portal/invoices/server/utils/invoice-email'
import { pool } from '@nuxt-customer-portal/core/server/utils/db'
import type { Order } from '@nuxt-customer-portal/products/shared/types'

const details = (order: Order, actorId: string) => ({
  reference: `products:${order.id}`,
  storeId: order.store_id,
  clientId: order.client_id!,
  actorId,
  title: order.lines.map((line) => line.snapshot.title).join(', '),
  currency: order.lines[0]!.snapshot.price.currency,
  net: order.net!,
  tax: order.tax!,
  total: order.total!,
  taxDetails: order.tax_details,
  recipientName:
    order.snapshot.billing.type === 'person' ? order.snapshot.billing.name : order.snapshot.billing.company,
  address: order.snapshot.billing.address,
  email: order.email,
  locale: order.snapshot.locale,
  paymentReference: order.payment_id!,
  lines: order.lines.map((line) => ({
    description: line.snapshot.title,
    quantity: line.quantity,
    net: line.net!,
    tax: line.tax!,
    taxDetails: line.tax_details
  }))
})
export default defineNitroPlugin(() => {
  registerOrderIntegration({
    assertReady: assertCommerceInvoicesReady,
    async invoice(tx, order, actorId) {
      const id = await createCommerceDocument(tx, details(order, actorId))
      await tx.query(
        'INSERT INTO invoice_products.order_invoice(order_id,invoice_id) VALUES($1,$2) ON CONFLICT DO NOTHING',
        [order.id, id]
      )
      return id
    },
    async refund(tx, order, actorId) {
      if (!order.refunded || !order.invoice_id) {
        return
      }
      const result = await tx.query<{ amount: number }>(
        'SELECT COALESCE(max(cumulative_amount),0) AS amount FROM invoice_products.refund_credit WHERE order_id=$1',
        [order.id]
      )
      const previous = result.rows[0]!.amount
      if (previous >= order.refunded) {
        return
      }
      const delta = order.refunded - previous
      const tax =
        Math.round((order.tax! * order.refunded) / order.total!) - Math.round((order.tax! * previous) / order.total!)
      const id = await createCommerceDocument(tx, {
        ...details(order, actorId),
        reference: `products:${order.id}:refund:${order.refunded}`,
        originalInvoiceId: order.invoice_id,
        net: -(delta - tax),
        tax: -tax,
        total: -delta,
        lines: [
          {
            description: order.lines.map((line) => line.snapshot.title).join(', '),
            quantity: 1,
            net: -(delta - tax),
            tax: -tax,
            taxDetails: order.tax_details
          }
        ]
      })
      await tx.query(
        'INSERT INTO invoice_products.refund_credit(order_id,cumulative_amount,invoice_id) VALUES($1,$2,$3)',
        [order.id, order.refunded, id]
      )
    },
    async notify(order, actorId) {
      if (!order.invoice_id) {
        return
      }
      const sent = await pool.query(
        "SELECT 1 FROM invoices.invoice_email_delivery WHERE invoice_id=$1 AND status='SENT' AND purpose='INVOICE'",
        [order.invoice_id]
      )
      if (sent.rowCount) {
        return
      }
      const preview = await getInvoiceEmailPreview(order.store_id, order.invoice_id)
      await deliverInvoiceEmail(
        order.store_id,
        order.invoice_id,
        actorId,
        { to: preview.to, cc: [], locale: order.snapshot.locale, subject: preview.subject, body: preview.body },
        false
      )
    }
  })
})
