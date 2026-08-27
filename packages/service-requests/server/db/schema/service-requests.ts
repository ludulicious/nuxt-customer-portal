import { date, index, integer, pgSchema, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core'
import { organization, user } from '@nuxt-customer-portal/core/schema'

export const serviceRequestsSchema = pgSchema('service_requests')
export const serviceRequestStatus = serviceRequestsSchema.enum('ServiceRequestStatus', [
  'NEW', 'EVALUATING', 'AWAITING_APPROVAL', 'ACCEPTED', 'IN_PROGRESS', 'COMPLETED', 'DECLINED', 'CANCELLED'
])
export const serviceRequestPriority = serviceRequestsSchema.enum('ServiceRequestPriority', ['LOW', 'MEDIUM', 'HIGH', 'URGENT'])
export const serviceRequestActivityType = serviceRequestsSchema.enum('service_request_activity_type', [
  'CREATED', 'COMMENT', 'STATUS_CHANGED', 'ASSIGNED', 'DETAILS_UPDATED', 'ATTACHMENT_ADDED',
  'ATTACHMENT_REMOVED', 'QUOTE_SENT', 'QUOTE_ACCEPTED', 'QUOTE_DECLINED', 'INVOICE_CREATED'
])
export const serviceRequestQuoteStatus = serviceRequestsSchema.enum('service_request_quote_status', [
  'DRAFT', 'SENT', 'ACCEPTED', 'DECLINED', 'SUPERSEDED', 'EXPIRED'
])

const audit = {
  createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'date' }).defaultNow().$onUpdate(() => new Date()).notNull()
}

export const serviceRequest = serviceRequestsSchema.table('service_request', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  description: text('description').notNull(),
  contactName: text('contact_name'),
  contactEmail: text('contact_email'),
  contactPhone: text('contact_phone'),
  requestedDate: date('requested_date', { mode: 'string' }),
  serviceLocation: text('service_location'),
  status: serviceRequestStatus('status').default('NEW').notNull(),
  priority: serviceRequestPriority('priority').default('MEDIUM').notNull(),
  category: text('category'),
  organizationId: text('organization_id').notNull().references(() => organization.id, { onDelete: 'cascade' }),
  clientOrganizationId: text('client_organization_id').notNull().references(() => organization.id, { onDelete: 'restrict' }),
  createdById: text('created_by_id').notNull().references(() => user.id, { onDelete: 'restrict' }),
  assignedToId: text('assigned_to_id').references(() => user.id, { onDelete: 'set null' }),
  internalNotes: text('internal_notes'),
  ...audit,
  evaluatingAt: timestamp('evaluating_at', { mode: 'date' }),
  acceptedAt: timestamp('accepted_at', { mode: 'date' }),
  startedAt: timestamp('started_at', { mode: 'date' }),
  completedAt: timestamp('completed_at', { mode: 'date' }),
  declinedAt: timestamp('declined_at', { mode: 'date' }),
  cancelledAt: timestamp('cancelled_at', { mode: 'date' })
}, (table) => [
  index('service_request_organization_id_idx').on(table.organizationId),
  index('service_request_client_organization_id_idx').on(table.clientOrganizationId),
  index('service_request_created_by_id_idx').on(table.createdById),
  index('service_request_assigned_to_id_idx').on(table.assignedToId),
  index('service_request_status_idx').on(table.status),
  index('service_request_requested_date_idx').on(table.organizationId, table.requestedDate),
  index('service_request_created_at_idx').on(table.createdAt)
])

export const serviceRequestActivity = serviceRequestsSchema.table('service_request_activity', {
  id: text('id').primaryKey(),
  requestId: text('request_id').notNull().references(() => serviceRequest.id, { onDelete: 'cascade' }),
  type: serviceRequestActivityType('type').notNull(),
  actorUserId: text('actor_user_id').notNull().references(() => user.id, { onDelete: 'restrict' }),
  body: text('body'),
  metadata: text('metadata'),
  createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull()
}, (table) => [index('service_request_activity_request_created_idx').on(table.requestId, table.createdAt)])

export const serviceRequestAttachment = serviceRequestsSchema.table('service_request_attachment', {
  id: text('id').primaryKey(),
  requestId: text('request_id').notNull().references(() => serviceRequest.id, { onDelete: 'cascade' }),
  fileName: text('file_name').notNull(),
  contentType: text('content_type').notNull(),
  size: integer('size').notNull(),
  contentBase64: text('content_base64').notNull(),
  uploadedById: text('uploaded_by_id').notNull().references(() => user.id, { onDelete: 'restrict' }),
  createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull()
}, (table) => [index('service_request_attachment_request_idx').on(table.requestId)])

export const serviceRequestQuote = serviceRequestsSchema.table('service_request_quote', {
  id: text('id').primaryKey(),
  requestId: text('request_id').notNull().references(() => serviceRequest.id, { onDelete: 'restrict' }),
  version: integer('version').notNull(),
  number: text('number').notNull(),
  status: serviceRequestQuoteStatus('status').default('DRAFT').notNull(),
  currency: text('currency').default('EUR').notNull(),
  validUntil: date('valid_until', { mode: 'string' }).notNull(),
  notes: text('notes'),
  createdById: text('created_by_id').notNull().references(() => user.id, { onDelete: 'restrict' }),
  sentAt: timestamp('sent_at', { mode: 'date' }),
  acceptedAt: timestamp('accepted_at', { mode: 'date' }),
  acceptedById: text('accepted_by_id').references(() => user.id, { onDelete: 'restrict' }),
  declinedAt: timestamp('declined_at', { mode: 'date' }),
  declinedById: text('declined_by_id').references(() => user.id, { onDelete: 'restrict' }),
  ...audit
}, (table) => [
  uniqueIndex('service_request_quote_request_version_uidx').on(table.requestId, table.version),
  uniqueIndex('service_request_quote_number_uidx').on(table.number),
  index('service_request_quote_request_idx').on(table.requestId)
])

export const serviceRequestQuoteLine = serviceRequestsSchema.table('service_request_quote_line', {
  id: text('id').primaryKey(),
  quoteId: text('quote_id').notNull().references(() => serviceRequestQuote.id, { onDelete: 'cascade' }),
  position: integer('position').notNull(),
  description: text('description').notNull(),
  quantityMilli: integer('quantity_milli').notNull(),
  unit: text('unit').notNull(),
  unitPriceMinor: integer('unit_price_minor').notNull(),
  vatRateBasisPoints: integer('vat_rate_basis_points').notNull()
}, (table) => [
  uniqueIndex('service_request_quote_line_position_uidx').on(table.quoteId, table.position),
  index('service_request_quote_line_quote_idx').on(table.quoteId)
])

export type ServiceRequestRecord = typeof serviceRequest.$inferSelect
export type NewServiceRequestRecord = typeof serviceRequest.$inferInsert
