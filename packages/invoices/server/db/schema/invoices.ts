import { boolean, date, index, integer, pgSchema, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'
import { organization, user } from '@nuxt-customer-portal/core/schema'

export const invoicesSchema = pgSchema('invoices')
export const invoiceStatus = invoicesSchema.enum('invoice_status', ['DRAFT', 'ISSUED', 'PAID', 'VOID'])
export const invoiceEmailDeliveryStatus = invoicesSchema.enum('invoice_email_delivery_status', ['PENDING', 'SENT', 'FAILED'])
export const invoiceEmailPurpose = invoicesSchema.enum('invoice_email_purpose', ['INVOICE', 'REMINDER'])
const audit = { createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(), updatedAt: timestamp('updated_at', { mode: 'date' }).defaultNow().$onUpdate(() => new Date()).notNull() }

export const invoiceSettings = invoicesSchema.table('settings', {
  organizationId: text('organization_id').primaryKey().references(() => organization.id, { onDelete: 'cascade' }),
  enabled: boolean('enabled').default(false).notNull(), currency: text('currency').default('EUR').notNull(),
  defaultVatRateBasisPoints: integer('default_vat_rate_basis_points').default(2100).notNull(),
  address: text('address').default('').notNull(), registrationNumber: text('registration_number'), vatNumber: text('vat_number'),
  iban: text('iban'), bic: text('bic'), invoiceEmail: text('invoice_email'), invoiceEmailTemplate: text('invoice_email_template'),
  preferredLocale: text('preferred_locale').default('nl').notNull(), ...audit
})

export const billingContact = invoicesSchema.table('billing_contact', {
  id: text('id').primaryKey(), organizationId: text('organization_id').notNull().references(() => organization.id, { onDelete: 'cascade' }),
  userId: text('user_id').references(() => user.id, { onDelete: 'set null' }), name: text('name').notNull(), email: text('email').notNull(),
  phone: text('phone'), jobTitle: text('job_title'), ...audit
}, table => [uniqueIndex('billing_contact_org_email_uidx').on(table.organizationId, table.email), index('billing_contact_org_idx').on(table.organizationId)])

export const invoiceClientAccess = invoicesSchema.table('client_access', {
  id: text('id').primaryKey(), providerOrganizationId: text('provider_organization_id').notNull().references(() => organization.id, { onDelete: 'cascade' }),
  clientOrganizationId: text('client_organization_id').notNull().references(() => organization.id, { onDelete: 'restrict' }),
  enabled: boolean('enabled').default(true).notNull(), ...audit
}, table => [uniqueIndex('invoice_client_access_provider_client_uidx').on(table.providerOrganizationId, table.clientOrganizationId), index('invoice_client_access_client_idx').on(table.clientOrganizationId)])

export const invoiceClientViewer = invoicesSchema.table('client_viewer', {
  id: text('id').primaryKey(), accessId: text('access_id').notNull().references(() => invoiceClientAccess.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }), createdById: text('created_by_id').notNull().references(() => user.id, { onDelete: 'restrict' }),
  createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull()
}, table => [uniqueIndex('invoice_client_viewer_access_user_uidx').on(table.accessId, table.userId), index('invoice_client_viewer_user_idx').on(table.userId)])

export const invoice = invoicesSchema.table('invoice', {
  id: text('id').primaryKey(), organizationId: text('organization_id').notNull().references(() => organization.id, { onDelete: 'cascade' }),
  clientOrganizationId: text('client_organization_id').references(() => organization.id, { onDelete: 'restrict' }), number: text('number').notNull(),
  status: invoiceStatus('status').default('DRAFT').notNull(), currency: text('currency').notNull(), issueDate: date('issue_date', { mode: 'string' }).notNull(), dueDate: date('due_date', { mode: 'string' }).notNull(),
  subject: text('subject'), notes: text('notes'), senderName: text('sender_name').notNull(), senderLogo: text('sender_logo'), senderAddress: text('sender_address').notNull(),
  senderRegistration: text('sender_registration'), senderVatNumber: text('sender_vat_number'), senderIban: text('sender_iban'), senderBic: text('sender_bic'),
  recipientName: text('recipient_name').notNull(), recipientAddress: text('recipient_address').notNull(), recipientContactName: text('recipient_contact_name'), recipientEmail: text('recipient_email'),
  recipientLocale: text('recipient_locale').default('nl').notNull(), createdById: text('created_by_id').notNull().references(() => user.id, { onDelete: 'restrict' }), issuedAt: timestamp('issued_at', { mode: 'date' }), ...audit
}, table => [uniqueIndex('invoice_org_number_uidx').on(table.organizationId, table.number), index('invoice_org_status_idx').on(table.organizationId, table.status), index('invoice_client_idx').on(table.clientOrganizationId)])

export const invoiceLine = invoicesSchema.table('invoice_line', {
  id: text('id').primaryKey(), invoiceId: text('invoice_id').notNull().references(() => invoice.id, { onDelete: 'cascade' }), position: integer('position').notNull(),
  description: text('description').notNull(), quantityMilli: integer('quantity_milli').notNull(), unit: text('unit').default('item').notNull(), unitPriceMinor: integer('unit_price_minor').notNull(), vatRateBasisPoints: integer('vat_rate_basis_points').default(2100).notNull()
}, table => [index('invoice_line_invoice_idx').on(table.invoiceId)])

export const invoicePayment = invoicesSchema.table('invoice_payment', {
  id: text('id').primaryKey(), invoiceId: text('invoice_id').notNull().references(() => invoice.id, { onDelete: 'cascade' }), paidOn: date('paid_on', { mode: 'string' }).notNull(),
  amountMinor: integer('amount_minor').notNull(), reference: text('reference'), note: text('note'), createdById: text('created_by_id').notNull().references(() => user.id, { onDelete: 'restrict' }), createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull()
}, table => [index('invoice_payment_invoice_idx').on(table.invoiceId)])

export const invoiceHistory = invoicesSchema.table('invoice_history', {
  id: text('id').primaryKey(), invoiceId: text('invoice_id').notNull().references(() => invoice.id, { onDelete: 'cascade' }), action: text('action').notNull(),
  actorUserId: text('actor_user_id').notNull().references(() => user.id, { onDelete: 'restrict' }), amountMinor: integer('amount_minor'), attachmentName: text('attachment_name'), createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull()
}, table => [index('invoice_history_invoice_idx').on(table.invoiceId)])

export const invoiceAttachment = invoicesSchema.table('invoice_attachment', {
  id: text('id').primaryKey(), invoiceId: text('invoice_id').notNull().references(() => invoice.id, { onDelete: 'cascade' }), fileName: text('file_name').notNull(), contentType: text('content_type').notNull(),
  size: integer('size').notNull(), contentBase64: text('content_base64').notNull(), uploadedById: text('uploaded_by_id').notNull().references(() => user.id, { onDelete: 'restrict' }), createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull()
}, table => [index('invoice_attachment_invoice_idx').on(table.invoiceId)])

export const invoiceEmailDelivery = invoicesSchema.table('invoice_email_delivery', {
  id: text('id').primaryKey(), invoiceId: text('invoice_id').notNull().references(() => invoice.id, { onDelete: 'cascade' }), status: invoiceEmailDeliveryStatus('status').default('PENDING').notNull(),
  purpose: invoiceEmailPurpose('purpose').default('INVOICE').notNull(), recipientEmail: text('recipient_email').notNull(), ccEmails: text('cc_emails').default('[]').notNull(), locale: text('locale').notNull(),
  subject: text('subject').notNull(), body: text('body').notNull(), actorUserId: text('actor_user_id').notNull().references(() => user.id, { onDelete: 'restrict' }), providerMessageId: text('provider_message_id'),
  providerLastEvent: text('provider_last_event'), providerStatusCheckedAt: timestamp('provider_status_checked_at', { mode: 'date' }), errorMessage: text('error_message'), payloadHash: text('payload_hash').notNull(),
  createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(), updatedAt: timestamp('updated_at', { mode: 'date' }).defaultNow().$onUpdate(() => new Date()).notNull(), sentAt: timestamp('sent_at', { mode: 'date' })
}, table => [index('invoice_email_delivery_invoice_idx').on(table.invoiceId, table.createdAt), uniqueIndex('invoice_email_delivery_pending_invoice_uidx').on(table.invoiceId).where(sql`${table.status} = 'PENDING'`)])
