import { index, pgSchema, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core'
import { invoice } from '@nuxt-customer-portal/invoices/schema'
import { serviceRequest, serviceRequestQuote } from '@nuxt-customer-portal/service-requests/schema'

export const invoiceServiceRequestsSchema = pgSchema('invoice_service_requests')
export const invoiceServiceRequest = invoiceServiceRequestsSchema.table('invoice_service_request', {
  id: text('id').primaryKey(),
  requestId: text('request_id').notNull().references(() => serviceRequest.id, { onDelete: 'restrict' }),
  quoteId: text('quote_id').references(() => serviceRequestQuote.id, { onDelete: 'restrict' }),
  invoiceId: text('invoice_id').notNull().references(() => invoice.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull()
}, (table) => [uniqueIndex('invoice_service_request_request_uidx').on(table.requestId), uniqueIndex('invoice_service_request_invoice_uidx').on(table.invoiceId), index('invoice_service_request_quote_idx').on(table.quoteId)])
