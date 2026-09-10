import { pgSchema, text, integer, primaryKey } from 'drizzle-orm/pg-core'
import { invoice } from '@nuxt-customer-portal/invoices/schema'
import { purchase } from '@nuxt-customer-portal/products/schema'

const schema = pgSchema('invoice_products')
export const orderInvoice = schema.table('order_invoice', {
  orderId: text('order_id')
    .primaryKey()
    .references(() => purchase.id),
  invoiceId: text('invoice_id')
    .notNull()
    .unique()
    .references(() => invoice.id)
})
export const refundCredit = schema.table(
  'refund_credit',
  {
    orderId: text('order_id')
      .notNull()
      .references(() => purchase.id),
    cumulativeAmount: integer('cumulative_amount').notNull(),
    invoiceId: text('invoice_id')
      .notNull()
      .unique()
      .references(() => invoice.id)
  },
  (t) => [primaryKey({ columns: [t.orderId, t.cumulativeAmount] })]
)
