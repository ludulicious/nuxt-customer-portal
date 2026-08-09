import { pgSchema, text, timestamp, jsonb, index } from 'drizzle-orm/pg-core'
import { organization, user } from '@nuxt-customer-portal/core/schema'

export const serviceRequestsSchema = pgSchema('service_requests')

export interface ServiceRequestAttachmentRecord {
  id: string
  url: string
  filename: string
  size: number
  mimeType: string
  uploadedAt: string
  uploadedById?: string
}

// Enums
export const serviceRequestStatus = serviceRequestsSchema.enum('ServiceRequestStatus', [
  'OPEN',
  'IN_PROGRESS',
  'RESOLVED',
  'CLOSED'
])

export const serviceRequestPriority = serviceRequestsSchema.enum('ServiceRequestPriority', [
  'LOW',
  'MEDIUM',
  'HIGH',
  'URGENT'
])

// Table
export const serviceRequest = serviceRequestsSchema.table('service_request', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  description: text('description').notNull(),
  status: serviceRequestStatus('status').default('OPEN').notNull(),
  priority: serviceRequestPriority('priority').default('MEDIUM').notNull(),
  category: text('category'),

  // Relations (FKs by convention; define explicit FKs in migrations if desired)
  organizationId: text('organization_id')
    .notNull()
    .references(() => organization.id, { onDelete: 'cascade' }),
  createdById: text('created_by_id')
    .notNull()
    .references(() => user.id, { onDelete: 'restrict' }),
  assignedToId: text('assigned_to_id')
    .references(() => user.id, { onDelete: 'set null' }),

  // Metadata
  attachments: jsonb('attachments').$type<ServiceRequestAttachmentRecord[]>(),
  internalNotes: text('internal_notes'),

  // Timestamps
  createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'date' })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
  resolvedAt: timestamp('resolved_at', { mode: 'date' }),
  closedAt: timestamp('closed_at', { mode: 'date' })
}, (table) => [
  index('service_request_organization_id_idx').on(table.organizationId),
  index('service_request_created_by_id_idx').on(table.createdById),
  index('service_request_assigned_to_id_idx').on(table.assignedToId),
  index('service_request_status_idx').on(table.status),
  index('service_request_created_at_idx').on(table.createdAt)
])

export type ServiceRequestRecord = typeof serviceRequest.$inferSelect
export type NewServiceRequestRecord = typeof serviceRequest.$inferInsert
