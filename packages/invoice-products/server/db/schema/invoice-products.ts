import { pgSchema, text, integer, primaryKey, timestamp, index } from 'drizzle-orm/pg-core'
import { invoice } from '@nuxt-customer-portal/invoices/schema'
import { orders } from '@nuxt-customer-portal/products/schema'

const schema = pgSchema('invoice_products')
export const orderInvoice = schema.table('order_invoice', {
  orderId: text('order_id')
    .primaryKey()
    .references(() => orders.id),
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
      .references(() => orders.id),
    cumulativeAmount: integer('cumulative_amount').notNull(),
    invoiceId: text('invoice_id')
      .notNull()
      .unique()
      .references(() => invoice.id)
  },
  (t) => [primaryKey({ columns: [t.orderId, t.cumulativeAmount] })]
)
export const invoiceEmailJob = schema.table(
  'email_job',
  {
    orderId: text('order_id')
      .primaryKey()
      .references(() => orders.id, { onDelete: 'cascade' }),
    actorId: text('actor_id').notNull(),
    availableAt: timestamp('available_at', { withTimezone: true }).notNull(),
    attempts: integer('attempts').notNull().default(0),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    error: text('error')
  },
  (t) => [index('invoice_products_email_job_pending').on(t.availableAt)]
)
