import { index, pgSchema, text } from 'drizzle-orm/pg-core'
import { invoice, invoiceLine } from '@nuxt-customer-portal/invoices/schema'
import { timeEntry } from '@nuxt-customer-portal/timesheets/schema'
export const invoiceTimesheetsSchema = pgSchema('invoice_timesheets')
export const invoiceTimeEntry = invoiceTimesheetsSchema.table('invoice_time_entry', { id: text('id').primaryKey(), invoiceId: text('invoice_id').notNull().references(() => invoice.id, { onDelete: 'cascade' }), invoiceLineId: text('invoice_line_id').notNull().references(() => invoiceLine.id, { onDelete: 'cascade' }), timeEntryId: text('time_entry_id').notNull().references(() => timeEntry.id, { onDelete: 'restrict' }) }, table => [index('invoice_time_entry_invoice_idx').on(table.invoiceId), index('invoice_time_entry_entry_idx').on(table.timeEntryId)])
