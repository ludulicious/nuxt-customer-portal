import { boolean, index, pgSchema, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core'
import { organization, user } from '@nuxt-customer-portal/core/schema'

export const clientsSchema = pgSchema('clients')

const auditColumns = {
  createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'date' }).defaultNow().$onUpdate(() => new Date()).notNull()
}

export const clientProfile = clientsSchema.table('client_profile', {
  organizationId: text('organization_id').primaryKey().references(() => organization.id, { onDelete: 'restrict' }),
  officialName: text('official_name').notNull(),
  address: text('address').default('').notNull(),
  registrationNumber: text('registration_number'),
  vatNumber: text('vat_number'),
  invoiceEmail: text('invoice_email'),
  preferredLocale: text('preferred_locale').default('nl').notNull(),
  archivedAt: timestamp('archived_at', { mode: 'date' }),
  archivedById: text('archived_by_id').references(() => user.id, { onDelete: 'set null' }),
  ...auditColumns
}, table => [index('client_profile_archived_idx').on(table.archivedAt)])

export const clientModule = clientsSchema.table('client_module', {
  id: text('id').primaryKey(),
  organizationId: text('organization_id').notNull().references(() => organization.id, { onDelete: 'restrict' }),
  moduleId: text('module_id').notNull(),
  enabled: boolean('enabled').default(true).notNull(),
  enabledAt: timestamp('enabled_at', { mode: 'date' }).defaultNow().notNull(),
  enabledById: text('enabled_by_id').references(() => user.id, { onDelete: 'set null' }),
  disabledAt: timestamp('disabled_at', { mode: 'date' }),
  disabledById: text('disabled_by_id').references(() => user.id, { onDelete: 'set null' }),
  ...auditColumns
}, table => [
  uniqueIndex('client_module_org_module_uidx').on(table.organizationId, table.moduleId),
  index('client_module_org_enabled_idx').on(table.organizationId, table.enabled)
])

export type ClientProfileRecord = typeof clientProfile.$inferSelect
export type ClientModuleRecord = typeof clientModule.$inferSelect
