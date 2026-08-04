import {
  boolean,
  date,
  index,
  integer,
  pgSchema,
  text,
  timestamp,
  uniqueIndex
} from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'
import { organization, user } from '~~/layers/portal-core/server/db/schema/auth-schema'

export const timesheetsSchema = pgSchema('timesheets')

export const timesheetStatus = timesheetsSchema.enum('timesheet_status', [
  'DRAFT',
  'SUBMITTED',
  'APPROVED',
  'REJECTED'
])
export const projectStatus = timesheetsSchema.enum('project_status', ['ACTIVE', 'ARCHIVED'])
export const approvalAction = timesheetsSchema.enum('approval_action', [
  'SUBMITTED',
  'APPROVED',
  'REJECTED',
  'REOPENED'
])
export const invoiceStatus = timesheetsSchema.enum('invoice_status', ['DRAFT', 'ISSUED', 'PAID', 'VOID'])
export const invoiceEmailDeliveryStatus = timesheetsSchema.enum('invoice_email_delivery_status', ['PENDING', 'SENT', 'FAILED'])
export const invoiceEmailPurpose = timesheetsSchema.enum('invoice_email_purpose', ['INVOICE', 'REMINDER'])
export const clientAccessMode = timesheetsSchema.enum('client_access_mode', ['DISABLED', 'VIEW', 'REVIEW'])
export const clientReviewStatus = timesheetsSchema.enum('client_review_status', ['PENDING', 'APPROVED', 'DISPUTED'])
export const clientReviewAction = timesheetsSchema.enum('client_review_action', ['APPROVED', 'DISPUTED'])

const auditColumns = {
  createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'date' }).defaultNow().$onUpdate(() => new Date()).notNull()
}

export const workspaceSettings = timesheetsSchema.table('workspace_settings', {
  organizationId: text('organization_id').primaryKey()
    .references(() => organization.id, { onDelete: 'cascade' }),
  currency: text('currency').default('EUR').notNull(),
  timezone: text('timezone').default('Europe/Amsterdam').notNull(),
  defaultVatRateBasisPoints: integer('default_vat_rate_basis_points').default(2100).notNull(),
  weekStartsOn: integer('week_starts_on').default(1).notNull(),
  workspaceEnabled: boolean('workspace_enabled').default(false).notNull(),
  invoicingEnabled: boolean('invoicing_enabled').default(false).notNull(),
  ...auditColumns
})

export const workspaceClient = timesheetsSchema.table('workspace_client', {
  id: text('id').primaryKey(),
  workspaceOrganizationId: text('workspace_organization_id').notNull()
    .references(() => organization.id, { onDelete: 'cascade' }),
  clientOrganizationId: text('client_organization_id').notNull()
    .references(() => organization.id, { onDelete: 'restrict' }),
  accessMode: clientAccessMode('access_mode').default('DISABLED').notNull(),
  ...auditColumns
}, table => [
  uniqueIndex('workspace_client_workspace_client_uidx')
    .on(table.workspaceOrganizationId, table.clientOrganizationId),
  index('workspace_client_workspace_idx').on(table.workspaceOrganizationId)
])

export const workspaceClientReviewer = timesheetsSchema.table('workspace_client_reviewer', {
  id: text('id').primaryKey(),
  workspaceClientId: text('workspace_client_id').notNull()
    .references(() => workspaceClient.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  createdById: text('created_by_id').notNull().references(() => user.id, { onDelete: 'restrict' }),
  createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull()
}, table => [
  uniqueIndex('workspace_client_reviewer_link_user_uidx').on(table.workspaceClientId, table.userId),
  index('workspace_client_reviewer_user_idx').on(table.userId)
])

export const organizationInvoiceProfile = timesheetsSchema.table('organization_invoice_profile', {
  organizationId: text('organization_id').primaryKey()
    .references(() => organization.id, { onDelete: 'cascade' }),
  address: text('address').default('').notNull(),
  registrationNumber: text('registration_number'),
  vatNumber: text('vat_number'),
  iban: text('iban'),
  bic: text('bic'),
  invoiceEmail: text('invoice_email'),
  invoiceEmailTemplate: text('invoice_email_template'),
  preferredLocale: text('preferred_locale').default('nl').notNull(),
  ...auditColumns
})

export const organizationContact = timesheetsSchema.table('organization_contact', {
  id: text('id').primaryKey(),
  organizationId: text('organization_id').notNull()
    .references(() => organization.id, { onDelete: 'cascade' }),
  userId: text('user_id').references(() => user.id, { onDelete: 'set null' }),
  name: text('name').notNull(),
  email: text('email').notNull(),
  phone: text('phone'),
  jobTitle: text('job_title'),
  ...auditColumns
}, table => [
  index('organization_contact_org_idx').on(table.organizationId),
  uniqueIndex('organization_contact_org_email_uidx').on(table.organizationId, table.email)
])

export const activityType = timesheetsSchema.table('activity_type', {
  id: text('id').primaryKey(),
  organizationId: text('organization_id').notNull()
    .references(() => organization.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  billable: boolean('billable').default(true).notNull(),
  active: boolean('active').default(true).notNull(),
  ...auditColumns
}, table => [
  uniqueIndex('activity_type_org_name_uidx').on(table.organizationId, table.name),
  index('activity_type_org_idx').on(table.organizationId)
])

export const project = timesheetsSchema.table('project', {
  id: text('id').primaryKey(),
  organizationId: text('organization_id').notNull()
    .references(() => organization.id, { onDelete: 'cascade' }),
  clientOrganizationId: text('client_organization_id').notNull()
    .references(() => organization.id, { onDelete: 'restrict' }),
  name: text('name').notNull(),
  code: text('code'),
  status: projectStatus('status').default('ACTIVE').notNull(),
  startsOn: date('starts_on', { mode: 'string' }),
  endsOn: date('ends_on', { mode: 'string' }),
  budgetMinutes: integer('budget_minutes'),
  budgetMinor: integer('budget_minor'),
  ...auditColumns
}, table => [
  uniqueIndex('project_org_name_uidx').on(table.organizationId, table.name),
  index('project_org_status_idx').on(table.organizationId, table.status),
  index('project_client_idx').on(table.clientOrganizationId)
])

export const projectActivity = timesheetsSchema.table('project_activity', {
  id: text('id').primaryKey(),
  projectId: text('project_id').notNull().references(() => project.id, { onDelete: 'cascade' }),
  activityTypeId: text('activity_type_id').notNull()
    .references(() => activityType.id, { onDelete: 'cascade' })
}, table => [
  uniqueIndex('project_activity_project_activity_uidx').on(table.projectId, table.activityTypeId)
])

export const teamTariff = timesheetsSchema.table('team_tariff', {
  id: text('id').primaryKey(),
  organizationId: text('organization_id').notNull()
    .references(() => organization.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  hourlyRateMinor: integer('hourly_rate_minor').notNull(),
  ...auditColumns
}, table => [
  uniqueIndex('team_tariff_org_user_uidx').on(table.organizationId, table.userId)
])

export const projectPersonTariff = timesheetsSchema.table('project_person_tariff', {
  id: text('id').primaryKey(),
  projectId: text('project_id').notNull().references(() => project.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  hourlyRateMinor: integer('hourly_rate_minor').notNull(),
  ...auditColumns
}, table => [
  uniqueIndex('project_person_tariff_project_user_uidx').on(table.projectId, table.userId)
])

export const weeklyTimesheet = timesheetsSchema.table('weekly_timesheet', {
  id: text('id').primaryKey(),
  organizationId: text('organization_id').notNull()
    .references(() => organization.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  weekStartsOn: date('week_starts_on', { mode: 'string' }).notNull(),
  status: timesheetStatus('status').default('DRAFT').notNull(),
  submittedAt: timestamp('submitted_at', { mode: 'date' }),
  reviewedAt: timestamp('reviewed_at', { mode: 'date' }),
  reviewedById: text('reviewed_by_id').references(() => user.id, { onDelete: 'set null' }),
  rejectionComment: text('rejection_comment'),
  ...auditColumns
}, table => [
  uniqueIndex('weekly_timesheet_org_user_week_uidx')
    .on(table.organizationId, table.userId, table.weekStartsOn),
  index('weekly_timesheet_org_status_idx').on(table.organizationId, table.status)
])

export const timeEntry = timesheetsSchema.table('time_entry', {
  id: text('id').primaryKey(),
  organizationId: text('organization_id').notNull()
    .references(() => organization.id, { onDelete: 'cascade' }),
  weeklyTimesheetId: text('weekly_timesheet_id').notNull()
    .references(() => weeklyTimesheet.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  projectId: text('project_id').notNull().references(() => project.id, { onDelete: 'restrict' }),
  clientOrganizationId: text('client_organization_id').notNull()
    .references(() => organization.id, { onDelete: 'restrict' }),
  activityTypeId: text('activity_type_id').notNull()
    .references(() => activityType.id, { onDelete: 'restrict' }),
  entryDate: date('entry_date', { mode: 'string' }).notNull(),
  durationMinutes: integer('duration_minutes').default(0).notNull(),
  note: text('note'),
  billableSnapshot: boolean('billable_snapshot').notNull(),
  hourlyRateMinorSnapshot: integer('hourly_rate_minor_snapshot').notNull(),
  currencySnapshot: text('currency_snapshot').notNull(),
  timerStartedAt: timestamp('timer_started_at', { mode: 'date' }),
  ...auditColumns
}, table => [
  index('time_entry_org_user_date_idx').on(table.organizationId, table.userId, table.entryDate),
  index('time_entry_week_idx').on(table.weeklyTimesheetId),
  index('time_entry_project_idx').on(table.projectId),
  index('time_entry_client_idx').on(table.clientOrganizationId)
])

export const timesheetClientReview = timesheetsSchema.table('client_review', {
  id: text('id').primaryKey(),
  weeklyTimesheetId: text('weekly_timesheet_id').notNull()
    .references(() => weeklyTimesheet.id, { onDelete: 'cascade' }),
  clientOrganizationId: text('client_organization_id').notNull()
    .references(() => organization.id, { onDelete: 'restrict' }),
  status: clientReviewStatus('status').default('PENDING').notNull(),
  reviewerUserId: text('reviewer_user_id').references(() => user.id, { onDelete: 'set null' }),
  comment: text('comment'),
  version: integer('version').default(1).notNull(),
  reviewedAt: timestamp('reviewed_at', { mode: 'date' }),
  ...auditColumns
}, table => [
  uniqueIndex('client_review_week_client_uidx').on(table.weeklyTimesheetId, table.clientOrganizationId),
  index('client_review_client_status_idx').on(table.clientOrganizationId, table.status)
])

export const timesheetClientReviewHistory = timesheetsSchema.table('client_review_history', {
  id: text('id').primaryKey(),
  weeklyTimesheetId: text('weekly_timesheet_id').notNull().references(() => weeklyTimesheet.id, { onDelete: 'cascade' }),
  clientOrganizationId: text('client_organization_id').notNull().references(() => organization.id, { onDelete: 'restrict' }),
  action: clientReviewAction('action').notNull(),
  actorUserId: text('actor_user_id').notNull().references(() => user.id, { onDelete: 'restrict' }),
  comment: text('comment'),
  createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull()
}, table => [
  index('client_review_history_week_client_idx').on(table.weeklyTimesheetId, table.clientOrganizationId, table.createdAt)
])

export const timesheetApprovalHistory = timesheetsSchema.table('approval_history', {
  id: text('id').primaryKey(),
  weeklyTimesheetId: text('weekly_timesheet_id').notNull()
    .references(() => weeklyTimesheet.id, { onDelete: 'cascade' }),
  action: approvalAction('action').notNull(),
  actorUserId: text('actor_user_id').notNull().references(() => user.id, { onDelete: 'restrict' }),
  comment: text('comment'),
  createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull()
}, table => [
  index('approval_history_week_idx').on(table.weeklyTimesheetId)
])

export const invoice = timesheetsSchema.table('invoice', {
  id: text('id').primaryKey(),
  organizationId: text('organization_id').notNull().references(() => organization.id, { onDelete: 'cascade' }),
  clientOrganizationId: text('client_organization_id').references(() => organization.id, { onDelete: 'restrict' }),
  number: text('number').notNull(),
  status: invoiceStatus('status').default('DRAFT').notNull(),
  currency: text('currency').notNull(),
  issueDate: date('issue_date', { mode: 'string' }).notNull(),
  dueDate: date('due_date', { mode: 'string' }).notNull(),
  subject: text('subject'),
  notes: text('notes'),
  senderName: text('sender_name').notNull(),
  senderLogo: text('sender_logo'),
  senderAddress: text('sender_address').notNull(),
  senderRegistration: text('sender_registration'),
  senderVatNumber: text('sender_vat_number'),
  senderIban: text('sender_iban'),
  senderBic: text('sender_bic'),
  recipientName: text('recipient_name').notNull(),
  recipientAddress: text('recipient_address').notNull(),
  recipientContactName: text('recipient_contact_name'),
  recipientEmail: text('recipient_email'),
  recipientLocale: text('recipient_locale').default('nl').notNull(),
  createdById: text('created_by_id').notNull().references(() => user.id, { onDelete: 'restrict' }),
  issuedAt: timestamp('issued_at', { mode: 'date' }),
  ...auditColumns
}, table => [
  uniqueIndex('invoice_org_number_uidx').on(table.organizationId, table.number),
  index('invoice_org_status_idx').on(table.organizationId, table.status),
  index('invoice_client_idx').on(table.clientOrganizationId)
])

export const invoiceLine = timesheetsSchema.table('invoice_line', {
  id: text('id').primaryKey(),
  invoiceId: text('invoice_id').notNull().references(() => invoice.id, { onDelete: 'cascade' }),
  position: integer('position').notNull(),
  description: text('description').notNull(),
  quantityMilli: integer('quantity_milli').notNull(),
  unit: text('unit').default('hour').notNull(),
  unitPriceMinor: integer('unit_price_minor').notNull(),
  vatRateBasisPoints: integer('vat_rate_basis_points').default(2100).notNull()
}, table => [index('invoice_line_invoice_idx').on(table.invoiceId)])

export const invoiceTimeEntry = timesheetsSchema.table('invoice_time_entry', {
  id: text('id').primaryKey(),
  invoiceId: text('invoice_id').notNull().references(() => invoice.id, { onDelete: 'cascade' }),
  invoiceLineId: text('invoice_line_id').notNull().references(() => invoiceLine.id, { onDelete: 'cascade' }),
  timeEntryId: text('time_entry_id').notNull().references(() => timeEntry.id, { onDelete: 'restrict' })
}, table => [
  index('invoice_time_entry_entry_idx').on(table.timeEntryId),
  index('invoice_time_entry_invoice_idx').on(table.invoiceId)
])

export const invoicePayment = timesheetsSchema.table('invoice_payment', {
  id: text('id').primaryKey(),
  invoiceId: text('invoice_id').notNull().references(() => invoice.id, { onDelete: 'cascade' }),
  paidOn: date('paid_on', { mode: 'string' }).notNull(),
  amountMinor: integer('amount_minor').notNull(),
  reference: text('reference'),
  note: text('note'),
  createdById: text('created_by_id').notNull().references(() => user.id, { onDelete: 'restrict' }),
  createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull()
}, table => [index('invoice_payment_invoice_idx').on(table.invoiceId)])

export const invoiceHistory = timesheetsSchema.table('invoice_history', {
  id: text('id').primaryKey(),
  invoiceId: text('invoice_id').notNull().references(() => invoice.id, { onDelete: 'cascade' }),
  action: text('action').notNull(),
  actorUserId: text('actor_user_id').notNull().references(() => user.id, { onDelete: 'restrict' }),
  amountMinor: integer('amount_minor'),
  attachmentName: text('attachment_name'),
  createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull()
}, table => [index('invoice_history_invoice_idx').on(table.invoiceId)])

export const invoiceAttachment = timesheetsSchema.table('invoice_attachment', {
  id: text('id').primaryKey(),
  invoiceId: text('invoice_id').notNull().references(() => invoice.id, { onDelete: 'cascade' }),
  fileName: text('file_name').notNull(),
  contentType: text('content_type').notNull(),
  size: integer('size').notNull(),
  contentBase64: text('content_base64').notNull(),
  uploadedById: text('uploaded_by_id').notNull().references(() => user.id, { onDelete: 'restrict' }),
  createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull()
}, table => [index('invoice_attachment_invoice_idx').on(table.invoiceId)])

export const invoiceEmailDelivery = timesheetsSchema.table('invoice_email_delivery', {
  id: text('id').primaryKey(),
  invoiceId: text('invoice_id').notNull().references(() => invoice.id, { onDelete: 'cascade' }),
  status: invoiceEmailDeliveryStatus('status').default('PENDING').notNull(),
  purpose: invoiceEmailPurpose('purpose').default('INVOICE').notNull(),
  recipientEmail: text('recipient_email').notNull(),
  ccEmails: text('cc_emails').default('[]').notNull(),
  locale: text('locale').notNull(),
  subject: text('subject').notNull(),
  body: text('body').notNull(),
  actorUserId: text('actor_user_id').notNull().references(() => user.id, { onDelete: 'restrict' }),
  providerMessageId: text('provider_message_id'),
  providerLastEvent: text('provider_last_event'),
  providerStatusCheckedAt: timestamp('provider_status_checked_at', { mode: 'date' }),
  errorMessage: text('error_message'),
  payloadHash: text('payload_hash').notNull(),
  createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'date' }).defaultNow().$onUpdate(() => new Date()).notNull(),
  sentAt: timestamp('sent_at', { mode: 'date' })
}, table => [
  index('invoice_email_delivery_invoice_idx').on(table.invoiceId, table.createdAt),
  uniqueIndex('invoice_email_delivery_pending_invoice_uidx').on(table.invoiceId).where(sql`${table.status} = 'PENDING'`)
])

export type ProjectRecord = typeof project.$inferSelect
export type ActivityTypeRecord = typeof activityType.$inferSelect
export type TimeEntryRecord = typeof timeEntry.$inferSelect
export type WeeklyTimesheetRecord = typeof weeklyTimesheet.$inferSelect
