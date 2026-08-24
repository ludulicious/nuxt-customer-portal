import { boolean, date, index, integer, pgSchema, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core'
import { organization, user } from '@nuxt-customer-portal/core/schema'

export const timesheetsSchema = pgSchema('timesheets')

export const timesheetStatus = timesheetsSchema.enum('timesheet_status', ['DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED'])
export const projectStatus = timesheetsSchema.enum('project_status', ['ACTIVE', 'ARCHIVED'])
export const approvalAction = timesheetsSchema.enum('approval_action', [
  'SUBMITTED',
  'APPROVED',
  'REJECTED',
  'REOPENED'
])
export const clientAccessMode = timesheetsSchema.enum('client_access_mode', ['DISABLED', 'VIEW', 'REVIEW'])
export const clientReviewStatus = timesheetsSchema.enum('client_review_status', ['PENDING', 'APPROVED', 'DISPUTED'])
export const clientReviewAction = timesheetsSchema.enum('client_review_action', ['APPROVED', 'DISPUTED'])

const auditColumns = {
  createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'date' })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull()
}

export const workspaceSettings = timesheetsSchema.table('workspace_settings', {
  organizationId: text('organization_id')
    .primaryKey()
    .references(() => organization.id, { onDelete: 'cascade' }),
  currency: text('currency').default('EUR').notNull(),
  timezone: text('timezone').default('Europe/Amsterdam').notNull(),
  weekStartsOn: integer('week_starts_on').default(1).notNull(),
  workspaceEnabled: boolean('workspace_enabled').default(false).notNull(),
  internalApprovalsEnabled: boolean('internal_approvals_enabled').default(true).notNull(),
  ...auditColumns
})

export const workspaceClient = timesheetsSchema.table(
  'workspace_client',
  {
    id: text('id').primaryKey(),
    workspaceOrganizationId: text('workspace_organization_id')
      .notNull()
      .references(() => organization.id, { onDelete: 'cascade' }),
    clientOrganizationId: text('client_organization_id')
      .notNull()
      .references(() => organization.id, { onDelete: 'restrict' }),
    accessMode: clientAccessMode('access_mode').default('DISABLED').notNull(),
    ...auditColumns
  },
  (table) => [
    uniqueIndex('workspace_client_workspace_client_uidx').on(table.workspaceOrganizationId, table.clientOrganizationId),
    index('workspace_client_workspace_idx').on(table.workspaceOrganizationId)
  ]
)

export const workspaceClientReviewer = timesheetsSchema.table(
  'workspace_client_reviewer',
  {
    id: text('id').primaryKey(),
    workspaceClientId: text('workspace_client_id')
      .notNull()
      .references(() => workspaceClient.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    createdById: text('created_by_id')
      .notNull()
      .references(() => user.id, { onDelete: 'restrict' }),
    createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull()
  },
  (table) => [
    uniqueIndex('workspace_client_reviewer_link_user_uidx').on(table.workspaceClientId, table.userId),
    index('workspace_client_reviewer_user_idx').on(table.userId)
  ]
)

export const activityType = timesheetsSchema.table(
  'activity_type',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organization.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    billable: boolean('billable').default(true).notNull(),
    active: boolean('active').default(true).notNull(),
    ...auditColumns
  },
  (table) => [
    uniqueIndex('activity_type_org_name_uidx').on(table.organizationId, table.name),
    index('activity_type_org_idx').on(table.organizationId)
  ]
)

export const project = timesheetsSchema.table(
  'project',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organization.id, { onDelete: 'cascade' }),
    clientOrganizationId: text('client_organization_id')
      .notNull()
      .references(() => organization.id, { onDelete: 'restrict' }),
    name: text('name').notNull(),
    code: text('code'),
    status: projectStatus('status').default('ACTIVE').notNull(),
    startsOn: date('starts_on', { mode: 'string' }),
    endsOn: date('ends_on', { mode: 'string' }),
    budgetMinutes: integer('budget_minutes'),
    budgetMinor: integer('budget_minor'),
    ...auditColumns
  },
  (table) => [
    uniqueIndex('project_org_name_uidx').on(table.organizationId, table.name),
    index('project_org_status_idx').on(table.organizationId, table.status),
    index('project_client_idx').on(table.clientOrganizationId)
  ]
)

export const projectActivity = timesheetsSchema.table(
  'project_activity',
  {
    id: text('id').primaryKey(),
    projectId: text('project_id')
      .notNull()
      .references(() => project.id, { onDelete: 'cascade' }),
    activityTypeId: text('activity_type_id')
      .notNull()
      .references(() => activityType.id, { onDelete: 'cascade' })
  },
  (table) => [uniqueIndex('project_activity_project_activity_uidx').on(table.projectId, table.activityTypeId)]
)

export const teamTariff = timesheetsSchema.table(
  'team_tariff',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organization.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    hourlyRateMinor: integer('hourly_rate_minor').notNull(),
    ...auditColumns
  },
  (table) => [uniqueIndex('team_tariff_org_user_uidx').on(table.organizationId, table.userId)]
)

export const teamMemberSettings = timesheetsSchema.table(
  'team_member_settings',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organization.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    canEnterTime: boolean('can_enter_time').default(true).notNull(),
    internalApprovalRequired: boolean('internal_approval_required').default(true).notNull(),
    ...auditColumns
  },
  (table) => [uniqueIndex('team_member_settings_org_user_uidx').on(table.organizationId, table.userId)]
)

export const internalApproverAssignment = timesheetsSchema.table(
  'internal_approver_assignment',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organization.id, { onDelete: 'cascade' }),
    submitterUserId: text('submitter_user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    approverUserId: text('approver_user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    createdById: text('created_by_id')
      .notNull()
      .references(() => user.id, { onDelete: 'restrict' }),
    createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull()
  },
  (table) => [
    uniqueIndex('internal_approver_assignment_org_submitter_approver_uidx').on(
      table.organizationId,
      table.submitterUserId,
      table.approverUserId
    ),
    index('internal_approver_assignment_approver_idx').on(table.organizationId, table.approverUserId),
    index('internal_approver_assignment_submitter_idx').on(table.organizationId, table.submitterUserId)
  ]
)

export const projectPersonTariff = timesheetsSchema.table(
  'project_person_tariff',
  {
    id: text('id').primaryKey(),
    projectId: text('project_id')
      .notNull()
      .references(() => project.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    hourlyRateMinor: integer('hourly_rate_minor').notNull(),
    ...auditColumns
  },
  (table) => [uniqueIndex('project_person_tariff_project_user_uidx').on(table.projectId, table.userId)]
)

export const weeklyTimesheet = timesheetsSchema.table(
  'weekly_timesheet',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organization.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    weekStartsOn: date('week_starts_on', { mode: 'string' }).notNull(),
    status: timesheetStatus('status').default('DRAFT').notNull(),
    submittedAt: timestamp('submitted_at', { mode: 'date' }),
    reviewedAt: timestamp('reviewed_at', { mode: 'date' }),
    reviewedById: text('reviewed_by_id').references(() => user.id, { onDelete: 'set null' }),
    rejectionComment: text('rejection_comment'),
    ...auditColumns
  },
  (table) => [
    uniqueIndex('weekly_timesheet_org_user_week_uidx').on(table.organizationId, table.userId, table.weekStartsOn),
    index('weekly_timesheet_org_status_idx').on(table.organizationId, table.status)
  ]
)

export const timeEntry = timesheetsSchema.table(
  'time_entry',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organization.id, { onDelete: 'cascade' }),
    weeklyTimesheetId: text('weekly_timesheet_id')
      .notNull()
      .references(() => weeklyTimesheet.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    projectId: text('project_id')
      .notNull()
      .references(() => project.id, { onDelete: 'restrict' }),
    clientOrganizationId: text('client_organization_id')
      .notNull()
      .references(() => organization.id, { onDelete: 'restrict' }),
    activityTypeId: text('activity_type_id')
      .notNull()
      .references(() => activityType.id, { onDelete: 'restrict' }),
    entryDate: date('entry_date', { mode: 'string' }).notNull(),
    durationMinutes: integer('duration_minutes').default(0).notNull(),
    note: text('note'),
    billableSnapshot: boolean('billable_snapshot').notNull(),
    hourlyRateMinorSnapshot: integer('hourly_rate_minor_snapshot').notNull(),
    currencySnapshot: text('currency_snapshot').notNull(),
    timerStartedAt: timestamp('timer_started_at', { mode: 'date' }),
    ...auditColumns
  },
  (table) => [
    index('time_entry_org_user_date_idx').on(table.organizationId, table.userId, table.entryDate),
    index('time_entry_week_idx').on(table.weeklyTimesheetId),
    index('time_entry_project_idx').on(table.projectId),
    index('time_entry_client_idx').on(table.clientOrganizationId)
  ]
)

export const timesheetClientReview = timesheetsSchema.table(
  'client_review',
  {
    id: text('id').primaryKey(),
    weeklyTimesheetId: text('weekly_timesheet_id')
      .notNull()
      .references(() => weeklyTimesheet.id, { onDelete: 'cascade' }),
    clientOrganizationId: text('client_organization_id')
      .notNull()
      .references(() => organization.id, { onDelete: 'restrict' }),
    status: clientReviewStatus('status').default('PENDING').notNull(),
    reviewerUserId: text('reviewer_user_id').references(() => user.id, { onDelete: 'set null' }),
    comment: text('comment'),
    version: integer('version').default(1).notNull(),
    reviewedAt: timestamp('reviewed_at', { mode: 'date' }),
    ...auditColumns
  },
  (table) => [
    uniqueIndex('client_review_week_client_uidx').on(table.weeklyTimesheetId, table.clientOrganizationId),
    index('client_review_client_status_idx').on(table.clientOrganizationId, table.status)
  ]
)

export const timesheetClientReviewHistory = timesheetsSchema.table(
  'client_review_history',
  {
    id: text('id').primaryKey(),
    weeklyTimesheetId: text('weekly_timesheet_id')
      .notNull()
      .references(() => weeklyTimesheet.id, { onDelete: 'cascade' }),
    clientOrganizationId: text('client_organization_id')
      .notNull()
      .references(() => organization.id, { onDelete: 'restrict' }),
    action: clientReviewAction('action').notNull(),
    actorUserId: text('actor_user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'restrict' }),
    comment: text('comment'),
    createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull()
  },
  (table) => [
    index('client_review_history_week_client_idx').on(
      table.weeklyTimesheetId,
      table.clientOrganizationId,
      table.createdAt
    )
  ]
)

export const timesheetApprovalHistory = timesheetsSchema.table(
  'approval_history',
  {
    id: text('id').primaryKey(),
    weeklyTimesheetId: text('weekly_timesheet_id')
      .notNull()
      .references(() => weeklyTimesheet.id, { onDelete: 'cascade' }),
    action: approvalAction('action').notNull(),
    actorUserId: text('actor_user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'restrict' }),
    comment: text('comment'),
    createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull()
  },
  (table) => [index('approval_history_week_idx').on(table.weeklyTimesheetId)]
)

export type ProjectRecord = typeof project.$inferSelect
export type ActivityTypeRecord = typeof activityType.$inferSelect
export type TimeEntryRecord = typeof timeEntry.$inferSelect
export type WeeklyTimesheetRecord = typeof weeklyTimesheet.$inferSelect
