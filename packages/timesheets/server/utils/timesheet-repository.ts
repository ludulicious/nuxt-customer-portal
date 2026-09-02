import { nanoid } from 'nanoid'
import { and, asc, desc, eq, gte, inArray, isNotNull, lte, sql } from 'drizzle-orm'
import {
  db,
  getPortalOrganizationsByIds,
  listPortalOrganizationMembers
} from '@nuxt-customer-portal/core/server/portal'
import { assertTimeEntriesReopenable } from '@nuxt-customer-portal/core/server/utils/business-hooks'
import {
  getClient as getSharedClient,
  listSelectableClients,
  requireClientModuleEnabled
} from '@nuxt-customer-portal/clients/server/utils/client-repository'
import { organization, user } from '@nuxt-customer-portal/core/schema'
import {
  activityType,
  internalApproverAssignment,
  project,
  projectActivity,
  projectPersonTariff,
  teamMemberSettings,
  teamTariff,
  timeEntry,
  timesheetClientReview,
  timesheetClientReviewHistory,
  timesheetApprovalHistory,
  weeklyTimesheet,
  workspaceClient,
  workspaceClientReviewer,
  workspaceSettings,
  type TimeEntryRecord,
  type WeeklyTimesheetRecord
} from '@nuxt-customer-portal/timesheets/server/db/schema/timesheets'
import type {
  ActivityTypeDto,
  ApprovalQueueItemDto,
  ClientDto,
  ProjectDto,
  ReportRowDto,
  TeamMemberDto,
  TimesheetsSetupStatusDto,
  TimesheetBootstrapDto,
  TimesheetReportDto,
  TimeEntryDto,
  WeekDto,
  ClientAccessMode,
  ClientTimesheetsDto,
  ClientWorkspaceDto,
  ClientReviewerDto,
  ClientApprovalsDto,
  ClientReviewerSupplierDto,
  ClientSupplierTimesheetItemDto,
  InternalApprovalConfigurationDto
} from '@nuxt-customer-portal/timesheets/shared/types/timesheet'
import { hasInvalidProjectActivityAssignments, type ReportQuery } from './timesheet-validation'
import { addIsoDays, mondayFor } from '@nuxt-customer-portal/timesheets/shared/timesheet-dates'
import { TIMESHEET_ERROR_CODES } from '@nuxt-customer-portal/timesheets/shared/timesheet-errors'

const toEntryDto = (row: TimeEntryRecord): TimeEntryDto => ({
  id: row.id,
  projectId: row.projectId,
  activityTypeId: row.activityTypeId,
  entryDate: row.entryDate,
  durationMinutes: row.durationMinutes,
  note: row.note,
  billable: row.billableSnapshot,
  hourlyRateMinor: row.hourlyRateMinorSnapshot,
  currency: row.currencySnapshot,
  timerStartedAt: row.timerStartedAt?.toISOString() ?? null
})

const toWeekDto = (row: WeeklyTimesheetRecord, entries: TimeEntryRecord[]): WeekDto => ({
  id: row.id,
  userId: row.userId,
  weekStartsOn: row.weekStartsOn,
  status: row.status,
  submittedAt: row.submittedAt?.toISOString() ?? null,
  reviewedAt: row.reviewedAt?.toISOString() ?? null,
  reviewedById: row.reviewedById,
  rejectionComment: row.rejectionComment,
  entries: entries.map(toEntryDto)
})

const hasDatabaseErrorCode = (error: unknown, code: string): boolean => {
  let current = error as { code?: string; cause?: unknown } | undefined
  while (current) {
    if (current.code === code) {
      return true
    }
    current = current.cause as { code?: string; cause?: unknown } | undefined
  }
  return false
}

const listTeamMemberSettings = async (organizationId: string) => {
  try {
    return await db.select().from(teamMemberSettings).where(eq(teamMemberSettings.organizationId, organizationId))
  } catch (error) {
    // Keep capability discovery backward-compatible while a deployment migration is pending.
    if (hasDatabaseErrorCode(error, '42P01')) {
      return []
    }
    throw error
  }
}

export const ensureSettings = async (organizationId: string) => {
  const [settings] = await db
    .select({ settings: workspaceSettings, organizationType: organization.organizationType })
    .from(workspaceSettings)
    .innerJoin(organization, eq(organization.id, workspaceSettings.organizationId))
    .where(eq(workspaceSettings.organizationId, organizationId))
    .limit(1)
  if (settings?.organizationType !== 'PROVIDER') {
    throw createError({
      statusCode: 403,
      message: 'Timesheets workspaces are only available to provider organizations'
    })
  }
  if (!settings.settings.workspaceEnabled) {
    throw createError({ statusCode: 403, message: 'Timesheets workspace is not enabled' })
  }
  return settings.settings
}

export const requireTimesheetWorkspace = async (organizationId: string) => {
  await ensureSettings(organizationId)
}

export const getOrganizationTimesheetCapabilities = async (organizationId: string) => {
  const [settings, clientLinks] = await Promise.all([
    db.select().from(workspaceSettings).where(eq(workspaceSettings.organizationId, organizationId)).limit(1),
    db
      .select({
        workspaceOrganizationId: workspaceClient.workspaceOrganizationId,
        workspaceName: organization.name,
        accessMode: workspaceClient.accessMode
      })
      .from(workspaceClient)
      .innerJoin(organization, eq(organization.id, workspaceClient.workspaceOrganizationId))
      .where(eq(workspaceClient.clientOrganizationId, organizationId))
      .orderBy(asc(organization.name))
  ])
  return { workspaceEnabled: settings[0]?.workspaceEnabled ?? false, clientOf: clientLinks }
}

export const updateOrganizationTimesheetCapabilities = async (
  organizationId: string,
  input: { workspaceEnabled: boolean }
) => {
  const [settings] = await db
    .insert(workspaceSettings)
    .values({ organizationId, ...input })
    .onConflictDoUpdate({
      target: workspaceSettings.organizationId,
      set: { ...input, updatedAt: new Date() }
    })
    .returning()
  return settings
}

export const ensureWeek = async (organizationId: string, userId: string, dateString?: string) => {
  const weekStartsOn = mondayFor(dateString)
  await db
    .insert(weeklyTimesheet)
    .values({
      id: nanoid(),
      organizationId,
      userId,
      weekStartsOn
    })
    .onConflictDoNothing()
  const [week] = await db
    .select()
    .from(weeklyTimesheet)
    .where(
      and(
        eq(weeklyTimesheet.organizationId, organizationId),
        eq(weeklyTimesheet.userId, userId),
        eq(weeklyTimesheet.weekStartsOn, weekStartsOn)
      )
    )
    .limit(1)
  if (!week) {
    throw createError({ statusCode: 500, message: 'Timesheet week unavailable' })
  }
  return week
}

export const listClients = async (organizationId: string): Promise<ClientDto[]> => {
  const links = await db
    .select()
    .from(workspaceClient)
    .where(eq(workspaceClient.workspaceOrganizationId, organizationId))
  if (!links.length) {
    return []
  }
  const sharedClients = (await Promise.all(links.map((link) => getSharedClient(link.clientOrganizationId)))).filter(
    Boolean
  )
  const byId = new Map(sharedClients.map((item) => [item!.organizationId, item!]))
  return links
    .flatMap((link) => {
      const client = byId.get(link.clientOrganizationId)
      return client
        ? [
            {
              id: link.id,
              organizationId: client.id,
              name: client.name,
              officialName: client.officialName,
              slug: client.slug,
              logo: client.logo,
              accessMode: link.accessMode
            }
          ]
        : []
    })
    .sort((a, b) => a.name.localeCompare(b.name))
}

export const listAvailableClientOrganizations = async (
  organizationId: string,
  _userId: string,
  _hasSystemAccess: boolean
) => {
  const [accessible, clients] = await Promise.all([listSelectableClients('timesheets'), listClients(organizationId)])
  const linkedIds = new Set(clients.map((client) => client.organizationId))
  return accessible.filter((item) => !linkedIds.has(item.id))
}

export const linkClient = async (
  organizationId: string,
  _userId: string,
  _hasSystemAccess: boolean,
  clientOrganizationId: string
) => {
  await requireClientModuleEnabled(clientOrganizationId, 'timesheets')
  const client = await getSharedClient(clientOrganizationId)
  if (!client) {
    throw createError({ statusCode: 404, message: 'Client organization not found' })
  }
  const [link] = await db
    .insert(workspaceClient)
    .values({
      id: nanoid(),
      workspaceOrganizationId: organizationId,
      clientOrganizationId: client.id
    })
    .onConflictDoNothing()
    .returning()
  if (!link) {
    throw createError({ statusCode: 409, message: 'Client is already linked' })
  }
  return link
}

export const ensureTimesheetClientSettings = async (organizationId: string, clientOrganizationId: string) => {
  if (clientOrganizationId === organizationId) {
    await ensureSettings(organizationId)
    return null
  }
  await requireClientModuleEnabled(clientOrganizationId, 'timesheets')
  const [existing] = await db
    .select()
    .from(workspaceClient)
    .where(
      and(
        eq(workspaceClient.workspaceOrganizationId, organizationId),
        eq(workspaceClient.clientOrganizationId, clientOrganizationId)
      )
    )
    .limit(1)
  if (existing) {
    return existing
  }
  const [created] = await db
    .insert(workspaceClient)
    .values({ id: nanoid(), workspaceOrganizationId: organizationId, clientOrganizationId })
    .returning()
  return created
}

export const updateClientAccess = async (organizationId: string, id: string, accessMode: ClientAccessMode) => {
  const [updated] = await db
    .update(workspaceClient)
    .set({ accessMode, updatedAt: new Date() })
    .where(and(eq(workspaceClient.id, id), eq(workspaceClient.workspaceOrganizationId, organizationId)))
    .returning()
  if (!updated) {
    throw createError({ statusCode: 404, message: 'Client not found' })
  }
  return updated
}

export const listClientWorkspaces = async (
  clientOrganizationId: string,
  userId: string,
  canManageReviewers: boolean
): Promise<ClientWorkspaceDto[]> => {
  const links = await db
    .select({ link: workspaceClient, workspaceName: organization.name })
    .from(workspaceClient)
    .innerJoin(organization, eq(organization.id, workspaceClient.workspaceOrganizationId))
    .where(
      and(
        eq(workspaceClient.clientOrganizationId, clientOrganizationId),
        inArray(workspaceClient.accessMode, ['VIEW', 'REVIEW'])
      )
    )
    .orderBy(asc(organization.name))
  const reviews = links.length
    ? await db
        .select()
        .from(workspaceClientReviewer)
        .where(
          and(
            inArray(
              workspaceClientReviewer.workspaceClientId,
              links.map((item) => item.link.id)
            ),
            eq(workspaceClientReviewer.userId, userId)
          )
        )
    : []
  const reviewerLinks = new Set(reviews.map((item) => item.workspaceClientId))
  return links.map(({ link, workspaceName }) => ({
    id: link.id,
    workspaceOrganizationId: link.workspaceOrganizationId,
    workspaceName,
    accessMode: link.accessMode,
    canReview: link.accessMode === 'REVIEW' && reviewerLinks.has(link.id),
    canManageReviewers
  }))
}

export const listClientReviewers = async (
  workspaceClientId: string,
  clientOrganizationId: string
): Promise<ClientReviewerDto[]> => {
  const [link] = await db
    .select()
    .from(workspaceClient)
    .where(
      and(eq(workspaceClient.id, workspaceClientId), eq(workspaceClient.clientOrganizationId, clientOrganizationId))
    )
    .limit(1)
  if (!link || link.accessMode === 'DISABLED') {
    throw createError({ statusCode: 404, message: 'Client workspace not found' })
  }
  const [members, assigned] = await Promise.all([
    listPortalOrganizationMembers(clientOrganizationId),
    db.select().from(workspaceClientReviewer).where(eq(workspaceClientReviewer.workspaceClientId, workspaceClientId))
  ])
  const assignedIds = new Set(assigned.map((item) => item.userId))
  return members.map((item) => {
    const fixedAccess = item.organizationRole === 'owner' || item.organizationRole === 'admin'
    return {
      id: item.id,
      name: item.name,
      email: item.email,
      role: item.organizationRole,
      assigned: fixedAccess || assignedIds.has(item.id),
      fixedAccess
    }
  })
}

export const listClientReviewerSuppliers = async (
  clientOrganizationId: string,
  userId: string
): Promise<ClientReviewerSupplierDto[]> => {
  const workspaces = (await listClientWorkspaces(clientOrganizationId, userId, true)).filter(
    (item) => item.accessMode === 'REVIEW'
  )
  if (!workspaces.length) {
    return []
  }
  const [reviewers, pending, members] = await Promise.all([
    db
      .select()
      .from(workspaceClientReviewer)
      .where(
        inArray(
          workspaceClientReviewer.workspaceClientId,
          workspaces.map((item) => item.id)
        )
      ),
    db
      .select({ supplierOrganizationId: weeklyTimesheet.organizationId })
      .from(timesheetClientReview)
      .innerJoin(weeklyTimesheet, eq(weeklyTimesheet.id, timesheetClientReview.weeklyTimesheetId))
      .where(
        and(
          eq(timesheetClientReview.clientOrganizationId, clientOrganizationId),
          eq(timesheetClientReview.status, 'PENDING')
        )
      ),
    listPortalOrganizationMembers(clientOrganizationId)
  ])
  const fixedIds = new Set(
    members
      .filter((item) => item.organizationRole === 'owner' || item.organizationRole === 'admin')
      .map((item) => item.id)
  )
  return workspaces.map((workspace) => {
    const reviewerIds = new Set(
      reviewers.filter((item) => item.workspaceClientId === workspace.id).map((item) => item.userId)
    )
    fixedIds.forEach((id) => reviewerIds.add(id))
    return {
      ...workspace,
      reviewerCount: reviewerIds.size,
      pendingCount: pending.filter((item) => item.supplierOrganizationId === workspace.workspaceOrganizationId).length
    }
  })
}

export const setClientReviewer = async (
  workspaceClientId: string,
  clientOrganizationId: string,
  actorUserId: string,
  userId: string,
  assigned: boolean
) => {
  const eligible = await listClientReviewers(workspaceClientId, clientOrganizationId)
  const selected = eligible.find((item) => item.id === userId)
  if (!selected) {
    throw createError({ statusCode: 400, message: 'Reviewer must be a current client member' })
  }
  if (selected.fixedAccess) {
    throw createError({ statusCode: 400, message: 'Organization owners and admins can always review timesheets' })
  }
  if (!assigned) {
    await db
      .delete(workspaceClientReviewer)
      .where(
        and(
          eq(workspaceClientReviewer.workspaceClientId, workspaceClientId),
          eq(workspaceClientReviewer.userId, userId)
        )
      )
    return { assigned: false }
  }
  await db
    .insert(workspaceClientReviewer)
    .values({ id: nanoid(), workspaceClientId, userId, createdById: actorUserId })
    .onConflictDoNothing()
  return { assigned: true }
}

export const listClientApprovals = async (
  clientOrganizationId: string,
  actorUserId: string,
  isAdmin: boolean
): Promise<ClientApprovalsDto> => {
  const links = await db
    .select({ link: workspaceClient, supplierName: organization.name })
    .from(workspaceClient)
    .innerJoin(organization, eq(organization.id, workspaceClient.workspaceOrganizationId))
    .where(
      and(eq(workspaceClient.clientOrganizationId, clientOrganizationId), eq(workspaceClient.accessMode, 'REVIEW'))
    )
  if (!links.length) {
    return { isAdmin, pendingCount: 0, items: [] }
  }
  const reviews = await db
    .select()
    .from(timesheetClientReview)
    .innerJoin(weeklyTimesheet, eq(weeklyTimesheet.id, timesheetClientReview.weeklyTimesheetId))
    .where(eq(timesheetClientReview.clientOrganizationId, clientOrganizationId))
  const weekIds = reviews.map((item) => item.client_review.weeklyTimesheetId)
  if (!weekIds.length) {
    return { isAdmin, pendingCount: 0, items: [] }
  }
  const [assignments, acted, entries, internalHistory, clientHistory] = await Promise.all([
    db
      .select()
      .from(workspaceClientReviewer)
      .where(
        and(
          inArray(
            workspaceClientReviewer.workspaceClientId,
            links.map((item) => item.link.id)
          ),
          eq(workspaceClientReviewer.userId, actorUserId)
        )
      ),
    db
      .select({ weeklyTimesheetId: timesheetClientReviewHistory.weeklyTimesheetId })
      .from(timesheetClientReviewHistory)
      .where(
        and(
          eq(timesheetClientReviewHistory.clientOrganizationId, clientOrganizationId),
          eq(timesheetClientReviewHistory.actorUserId, actorUserId)
        )
      ),
    db
      .select({ entry: timeEntry, projectName: project.name, activityName: activityType.name, personName: user.name })
      .from(timeEntry)
      .innerJoin(project, eq(project.id, timeEntry.projectId))
      .innerJoin(activityType, eq(activityType.id, timeEntry.activityTypeId))
      .innerJoin(user, eq(user.id, timeEntry.userId))
      .where(
        and(inArray(timeEntry.weeklyTimesheetId, weekIds), eq(timeEntry.clientOrganizationId, clientOrganizationId))
      )
      .orderBy(asc(timeEntry.entryDate), asc(timeEntry.createdAt)),
    db
      .select({ history: timesheetApprovalHistory, actorName: user.name })
      .from(timesheetApprovalHistory)
      .innerJoin(user, eq(user.id, timesheetApprovalHistory.actorUserId))
      .where(
        and(
          inArray(timesheetApprovalHistory.weeklyTimesheetId, weekIds),
          inArray(timesheetApprovalHistory.action, ['SUBMITTED', 'APPROVED', 'REOPENED'])
        )
      ),
    db
      .select({ history: timesheetClientReviewHistory, actorName: user.name })
      .from(timesheetClientReviewHistory)
      .innerJoin(user, eq(user.id, timesheetClientReviewHistory.actorUserId))
      .where(
        and(
          inArray(timesheetClientReviewHistory.weeklyTimesheetId, weekIds),
          eq(timesheetClientReviewHistory.clientOrganizationId, clientOrganizationId)
        )
      )
  ])
  const assignedLinks = new Set(assignments.map((item) => item.workspaceClientId))
  const actedWeeks = new Set(acted.map((item) => item.weeklyTimesheetId))
  const reviewerIds = [
    ...new Set(reviews.map((item) => item.client_review.reviewerUserId).filter((id): id is string => Boolean(id)))
  ]
  const reviewerUsers = reviewerIds.length
    ? await db.select({ id: user.id, name: user.name }).from(user).where(inArray(user.id, reviewerIds))
    : []
  const reviewerNames = new Map(reviewerUsers.map((item) => [item.id, item.name]))
  const allAssignments = await db
    .select()
    .from(workspaceClientReviewer)
    .where(
      inArray(
        workspaceClientReviewer.workspaceClientId,
        links.map((item) => item.link.id)
      )
    )
  const items = reviews
    .flatMap(({ client_review: review, weekly_timesheet: week }) => {
      const link = links.find((item) => item.link.workspaceOrganizationId === week.organizationId)
      if (!link || (!isAdmin && !assignedLinks.has(link.link.id) && !actedWeeks.has(week.id))) {
        return []
      }
      const rows = entries.filter((item) => item.entry.weeklyTimesheetId === week.id)
      if (!rows.length) {
        return []
      }
      return [
        {
          id: review.id,
          workspaceClientId: link.link.id,
          supplierName: link.supplierName,
          weeklyTimesheetId: week.id,
          weekStartsOn: week.weekStartsOn,
          person: rows[0]!.personName,
          totalMinutes: rows.reduce((total, item) => total + item.entry.durationMinutes, 0),
          status: review.status,
          version: review.version,
          comment: review.comment,
          reviewedAt: review.reviewedAt?.toISOString() ?? null,
          reviewerName: review.reviewerUserId ? (reviewerNames.get(review.reviewerUserId) ?? null) : null,
          hasReviewers: allAssignments.some((item) => item.workspaceClientId === link.link.id),
          canAct: review.status === 'PENDING' && (isAdmin || assignedLinks.has(link.link.id)),
          canManageReviewers: isAdmin,
          entries: rows.map(({ entry, projectName, activityName, personName }) => ({
            id: entry.id,
            date: entry.entryDate,
            project: projectName,
            person: personName,
            activity: activityName,
            minutes: entry.durationMinutes,
            note: entry.note
          })),
          history: [
            ...internalHistory
              .filter((item) => item.history.weeklyTimesheetId === week.id)
              .map((item) => ({
                id: item.history.id,
                action:
                  item.history.action === 'SUBMITTED'
                    ? ('SUBMITTED' as const)
                    : item.history.action === 'REOPENED'
                      ? ('REOPENED' as const)
                      : ('APPROVED_INTERNAL' as const),
                actorName: item.actorName,
                comment: item.history.comment,
                createdAt: item.history.createdAt.toISOString()
              })),
            ...clientHistory
              .filter((item) => item.history.weeklyTimesheetId === week.id)
              .map((item) => ({
                id: item.history.id,
                action:
                  item.history.action === 'APPROVED' ? ('APPROVED_CLIENT' as const) : ('DISPUTED_CLIENT' as const),
                actorName: item.actorName,
                comment: item.history.comment,
                createdAt: item.history.createdAt.toISOString()
              }))
          ].sort((a, b) => a.createdAt.localeCompare(b.createdAt))
        }
      ]
    })
    .sort((a, b) =>
      a.status === b.status ? b.weekStartsOn.localeCompare(a.weekStartsOn) : a.status === 'PENDING' ? -1 : 1
    )
  return { isAdmin, pendingCount: items.filter((item) => item.status === 'PENDING' && item.canAct).length, items }
}

export const listClientApprovalSuppliers = async (
  clientOrganizationId: string,
  actorUserId: string,
  isAdmin: boolean
) => {
  const approvals = await listClientApprovals(clientOrganizationId, actorUserId, isAdmin)
  return [
    ...new Map(
      approvals.items.map((item) => [item.workspaceClientId, { id: item.workspaceClientId, name: item.supplierName }])
    ).values()
  ].sort((a, b) => a.name.localeCompare(b.name))
}

const findOwnedClient = async (organizationId: string, id: string) => {
  const [link] = await db
    .select()
    .from(workspaceClient)
    .where(and(eq(workspaceClient.id, id), eq(workspaceClient.workspaceOrganizationId, organizationId)))
    .limit(1)
  if (!link) {
    throw createError({ statusCode: 404, message: 'Client not found' })
  }
  const [client] = await getPortalOrganizationsByIds([link.clientOrganizationId])
  if (!client) {
    throw createError({ statusCode: 404, message: 'Client organization not found' })
  }
  return { link, client }
}

export const getClientDeletionEligibility = async (organizationId: string, id: string) => {
  const { link, client } = await findOwnedClient(organizationId, id)
  const [existingProject] = await db
    .select({ id: project.id })
    .from(project)
    .where(and(eq(project.organizationId, organizationId), eq(project.clientOrganizationId, link.clientOrganizationId)))
    .limit(1)
  return { clientId: link.id, clientName: client.name, canDelete: !existingProject }
}

export const deleteClient = async (organizationId: string, id: string, clientName: string) =>
  db.transaction(async (tx) => {
    const [link] = await tx
      .select()
      .from(workspaceClient)
      .where(and(eq(workspaceClient.id, id), eq(workspaceClient.workspaceOrganizationId, organizationId)))
      .limit(1)
    if (!link) {
      throw createError({ statusCode: 404, message: 'Client not found' })
    }
    const [client] = await getPortalOrganizationsByIds([link.clientOrganizationId])
    if (!client) {
      throw createError({ statusCode: 404, message: 'Client organization not found' })
    }
    if (client.name !== clientName) {
      throw createError({ statusCode: 400, message: 'Client name does not match' })
    }
    const [existingProject] = await tx
      .select({ id: project.id })
      .from(project)
      .where(
        and(eq(project.organizationId, organizationId), eq(project.clientOrganizationId, link.clientOrganizationId))
      )
      .limit(1)
    if (existingProject) {
      throw createError({ statusCode: 409, message: 'Clients with linked projects cannot be removed' })
    }
    await tx
      .delete(workspaceClient)
      .where(and(eq(workspaceClient.id, id), eq(workspaceClient.workspaceOrganizationId, organizationId)))
    return { deleted: true }
  })

export const listActivities = async (organizationId: string): Promise<ActivityTypeDto[]> =>
  db
    .select({
      id: activityType.id,
      name: activityType.name,
      billable: activityType.billable,
      active: activityType.active
    })
    .from(activityType)
    .where(eq(activityType.organizationId, organizationId))
    .orderBy(desc(activityType.active), asc(activityType.name))

export const createActivity = async (organizationId: string, input: { name: string; billable: boolean }) => {
  const [created] = await db
    .insert(activityType)
    .values({
      id: nanoid(),
      organizationId,
      ...input
    })
    .returning()
  return created
}

export const updateActivity = async (
  organizationId: string,
  id: string,
  input: Partial<{ name: string; billable: boolean; active: boolean }>
) => {
  const [updated] = await db
    .update(activityType)
    .set(input)
    .where(and(eq(activityType.id, id), eq(activityType.organizationId, organizationId)))
    .returning()
  if (!updated) {
    throw createError({ statusCode: 404, message: 'Activity type not found' })
  }
  return updated
}

const findOwnedActivity = async (organizationId: string, id: string) => {
  const [selectedActivity] = await db
    .select({
      id: activityType.id,
      name: activityType.name
    })
    .from(activityType)
    .where(and(eq(activityType.id, id), eq(activityType.organizationId, organizationId)))
    .limit(1)
  if (!selectedActivity) {
    throw createError({ statusCode: 404, message: 'Activity type not found' })
  }
  return selectedActivity
}

export const getActivityDeletionEligibility = async (organizationId: string, id: string) => {
  const selectedActivity = await findOwnedActivity(organizationId, id)
  const [existingEntry] = await db
    .select({ id: timeEntry.id })
    .from(timeEntry)
    .where(and(eq(timeEntry.organizationId, organizationId), eq(timeEntry.activityTypeId, id)))
    .limit(1)
  return {
    activityId: selectedActivity.id,
    activityName: selectedActivity.name,
    canDelete: !existingEntry
  }
}

export const deleteActivity = async (organizationId: string, id: string, activityName: string) =>
  db.transaction(async (tx) => {
    const [selectedActivity] = await tx
      .select({
        id: activityType.id,
        name: activityType.name
      })
      .from(activityType)
      .where(and(eq(activityType.id, id), eq(activityType.organizationId, organizationId)))
      .limit(1)
    if (!selectedActivity) {
      throw createError({ statusCode: 404, message: 'Activity type not found' })
    }
    if (selectedActivity.name !== activityName) {
      throw createError({ statusCode: 400, message: 'Activity name does not match' })
    }

    const [existingEntry] = await tx
      .select({ id: timeEntry.id })
      .from(timeEntry)
      .where(and(eq(timeEntry.organizationId, organizationId), eq(timeEntry.activityTypeId, id)))
      .limit(1)
    if (existingEntry) {
      throw createError({ statusCode: 409, message: 'Activities with existing time entries cannot be deleted' })
    }

    await tx.delete(activityType).where(and(eq(activityType.id, id), eq(activityType.organizationId, organizationId)))
    return { deleted: true }
  })

export const listTeam = async (organizationId: string): Promise<TeamMemberDto[]> => {
  const [members, tariffs, memberSettings, assignments] = await Promise.all([
    listPortalOrganizationMembers(organizationId),
    db.select().from(teamTariff).where(eq(teamTariff.organizationId, organizationId)),
    listTeamMemberSettings(organizationId),
    db.select().from(internalApproverAssignment).where(eq(internalApproverAssignment.organizationId, organizationId))
  ])
  const tariffByUser = new Map(tariffs.map((item) => [item.userId, item.hourlyRateMinor]))
  const settingsByUser = new Map(memberSettings.map((item) => [item.userId, item.canEnterTime]))
  return members.map((item) => ({
    ...item,
    image: item.image ?? null,
    defaultHourlyRateMinor: tariffByUser.get(item.id) ?? null,
    canEnterTime: settingsByUser.get(item.id) ?? true,
    internalApprovalRequired:
      memberSettings.find((setting) => setting.userId === item.id)?.internalApprovalRequired ?? true,
    approverUserIds: assignments
      .filter((assignment) => assignment.submitterUserId === item.id)
      .map((assignment) => assignment.approverUserId)
  }))
}

export const getInternalApprovalConfiguration = async (
  organizationId: string
): Promise<InternalApprovalConfigurationDto> => {
  const [settings, members] = await Promise.all([ensureSettings(organizationId), listTeam(organizationId)])
  return { enabled: settings.internalApprovalsEnabled, members }
}

export const hasInternalApprovalAssignment = async (organizationId: string, approverUserId: string) => {
  const [assignment] = await db
    .select({ id: internalApproverAssignment.id })
    .from(internalApproverAssignment)
    .where(
      and(
        eq(internalApproverAssignment.organizationId, organizationId),
        eq(internalApproverAssignment.approverUserId, approverUserId)
      )
    )
    .limit(1)
  return Boolean(assignment)
}

type TimesheetTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0]

const autoApprovePendingWeeks = async (tx: TimesheetTransaction, organizationId: string, userId?: string) => {
  const conditions = [eq(weeklyTimesheet.organizationId, organizationId), eq(weeklyTimesheet.status, 'SUBMITTED')]
  if (userId) {
    conditions.push(eq(weeklyTimesheet.userId, userId))
  }
  const pending = await tx
    .select()
    .from(weeklyTimesheet)
    .where(and(...conditions))
  for (const week of pending) {
    const now = new Date()
    const [approved] = await tx
      .update(weeklyTimesheet)
      .set({ status: 'APPROVED', reviewedAt: now, reviewedById: null, rejectionComment: null })
      .where(and(eq(weeklyTimesheet.id, week.id), eq(weeklyTimesheet.status, 'SUBMITTED')))
      .returning({ id: weeklyTimesheet.id })
    if (!approved) {
      continue
    }
    await tx.insert(timesheetApprovalHistory).values({
      id: nanoid(),
      weeklyTimesheetId: week.id,
      action: 'APPROVED',
      actorUserId: week.userId,
      comment: 'Automatically approved because internal approval was disabled'
    })
    const representedClients = await tx
      .selectDistinct({ clientOrganizationId: timeEntry.clientOrganizationId })
      .from(timeEntry)
      .innerJoin(
        workspaceClient,
        and(
          eq(workspaceClient.workspaceOrganizationId, organizationId),
          eq(workspaceClient.clientOrganizationId, timeEntry.clientOrganizationId),
          eq(workspaceClient.accessMode, 'REVIEW')
        )
      )
      .where(eq(timeEntry.weeklyTimesheetId, week.id))
    if (representedClients.length) {
      await tx
        .insert(timesheetClientReview)
        .values(
          representedClients.map((item) => ({
            id: nanoid(),
            weeklyTimesheetId: week.id,
            clientOrganizationId: item.clientOrganizationId,
            status: 'PENDING' as const
          }))
        )
        .onConflictDoNothing()
    }
  }
}

export const updateInternalApprovalWorkspace = async (organizationId: string, enabled: boolean) => {
  await ensureSettings(organizationId)
  await db.transaction(async (tx) => {
    await tx
      .update(workspaceSettings)
      .set({ internalApprovalsEnabled: enabled })
      .where(eq(workspaceSettings.organizationId, organizationId))
    if (!enabled) {
      await autoApprovePendingWeeks(tx, organizationId)
    }
  })
}

export const updateInternalApprovalMember = async (
  organizationId: string,
  actorUserId: string,
  submitterUserId: string,
  input: { required: boolean; approverUserIds: string[] }
) => {
  const members = await listPortalOrganizationMembers(organizationId)
  if (!members.some((member) => member.id === submitterUserId)) {
    throw createError({
      statusCode: 404,
      message: 'Team member not found',
      data: { code: TIMESHEET_ERROR_CODES.internalApprovalMemberInvalid }
    })
  }
  const uniqueApproverIds = [...new Set(input.approverUserIds)]
  if (uniqueApproverIds.length !== input.approverUserIds.length) {
    throw createError({
      statusCode: 400,
      message: 'An approver can only be assigned once',
      data: { code: TIMESHEET_ERROR_CODES.internalApprovalDuplicateAssignment }
    })
  }
  if (uniqueApproverIds.includes(submitterUserId)) {
    throw createError({
      statusCode: 400,
      message: 'A member cannot approve their own timesheet',
      data: { code: TIMESHEET_ERROR_CODES.internalApprovalSelfAssignment }
    })
  }
  if (uniqueApproverIds.some((id) => !members.some((member) => member.id === id))) {
    throw createError({
      statusCode: 400,
      message: 'Every approver must belong to this organization',
      data: { code: TIMESHEET_ERROR_CODES.internalApprovalMemberInvalid }
    })
  }
  await db.transaction(async (tx) => {
    await tx
      .insert(teamMemberSettings)
      .values({
        id: nanoid(),
        organizationId,
        userId: submitterUserId,
        canEnterTime: true,
        internalApprovalRequired: input.required
      })
      .onConflictDoUpdate({
        target: [teamMemberSettings.organizationId, teamMemberSettings.userId],
        set: { internalApprovalRequired: input.required, updatedAt: new Date() }
      })
    await tx
      .delete(internalApproverAssignment)
      .where(
        and(
          eq(internalApproverAssignment.organizationId, organizationId),
          eq(internalApproverAssignment.submitterUserId, submitterUserId)
        )
      )
    if (input.required && uniqueApproverIds.length) {
      await tx.insert(internalApproverAssignment).values(
        uniqueApproverIds.map((approverUserId) => ({
          id: nanoid(),
          organizationId,
          submitterUserId,
          approverUserId,
          createdById: actorUserId
        }))
      )
    }
    if (!input.required) {
      await autoApprovePendingWeeks(tx, organizationId, submitterUserId)
    }
  })
}

export const canMemberEnterTime = async (organizationId: string, userId: string) => {
  try {
    const [settings] = await db
      .select({ canEnterTime: teamMemberSettings.canEnterTime })
      .from(teamMemberSettings)
      .where(and(eq(teamMemberSettings.organizationId, organizationId), eq(teamMemberSettings.userId, userId)))
      .limit(1)
    return settings?.canEnterTime ?? true
  } catch (error) {
    if (hasDatabaseErrorCode(error, '42P01')) {
      return true
    }
    throw error
  }
}

const requireMemberCanEnterTime = async (organizationId: string, userId: string) => {
  if (await canMemberEnterTime(organizationId, userId)) {
    return
  }
  throw createError({
    statusCode: 403,
    message: 'Time registration is disabled for this member',
    data: { code: TIMESHEET_ERROR_CODES.entryDisabled }
  })
}

export const updateTeamMemberSettings = async (
  organizationId: string,
  userId: string,
  input: { canEnterTime: boolean; defaultHourlyRateMinor: number | null }
) => {
  const member = (await listPortalOrganizationMembers(organizationId)).find((item) => item.id === userId)
  if (!member) {
    throw createError({ statusCode: 404, message: 'Team member not found' })
  }
  if (!input.canEnterTime) {
    const [running] = await db
      .select({ id: timeEntry.id })
      .from(timeEntry)
      .where(
        and(
          eq(timeEntry.organizationId, organizationId),
          eq(timeEntry.userId, userId),
          isNotNull(timeEntry.timerStartedAt)
        )
      )
      .limit(1)
    if (running) {
      throw createError({
        statusCode: 409,
        message: 'Stop the running timer before disabling time registration',
        data: { code: TIMESHEET_ERROR_CODES.runningTimer }
      })
    }
  }
  await db.transaction(async (tx) => {
    await tx
      .insert(teamMemberSettings)
      .values({
        id: nanoid(),
        organizationId,
        userId,
        canEnterTime: input.canEnterTime
      })
      .onConflictDoUpdate({
        target: [teamMemberSettings.organizationId, teamMemberSettings.userId],
        set: { canEnterTime: input.canEnterTime, updatedAt: new Date() }
      })
    if (input.defaultHourlyRateMinor === null) {
      await tx
        .delete(teamTariff)
        .where(and(eq(teamTariff.organizationId, organizationId), eq(teamTariff.userId, userId)))
    } else {
      await tx
        .insert(teamTariff)
        .values({
          id: nanoid(),
          organizationId,
          userId,
          hourlyRateMinor: input.defaultHourlyRateMinor
        })
        .onConflictDoUpdate({
          target: [teamTariff.organizationId, teamTariff.userId],
          set: { hourlyRateMinor: input.defaultHourlyRateMinor, updatedAt: new Date() }
        })
    }
  })
}

export const calculateTimesheetsSetupStatus = (
  clients: ClientDto[],
  projects: ProjectDto[],
  activities: ActivityTypeDto[],
  team: TeamMemberDto[]
): TimesheetsSetupStatusDto => {
  const activeActivities = activities.filter((item) => item.active)
  const activeActivityIds = new Set(activeActivities.map((item) => item.id))
  const activeProjects = projects.filter((item) => item.status === 'ACTIVE')
  const billableActivityIds = new Set(activeActivities.filter((item) => item.billable).map((item) => item.id))
  const billableWorkExists = activeProjects.some((item) =>
    item.activityTypeIds.some((id) => billableActivityIds.has(id))
  )
  const enabledMembers = team.filter((item) => item.canEnterTime)
  const missingDefaultTariffCount = enabledMembers.filter((item) => item.defaultHourlyRateMinor === null).length
  const status = {
    hasClient: clients.length > 0 || activeProjects.some((item) => item.internal),
    hasActiveActivity: activeActivities.length > 0,
    hasConfiguredProject: activeProjects.some((item) => item.activityTypeIds.some((id) => activeActivityIds.has(id))),
    billableWorkExists,
    enabledMemberCount: enabledMembers.length,
    missingDefaultTariffCount
  }
  return {
    ...status,
    complete:
      status.hasClient && status.hasActiveActivity && status.hasConfiguredProject && missingDefaultTariffCount === 0
  }
}

export const getTimesheetsSetupStatus = async (organizationId: string): Promise<TimesheetsSetupStatusDto> => {
  const [clients, projects, activities, team] = await Promise.all([
    listClients(organizationId),
    listProjects(organizationId),
    listActivities(organizationId),
    listTeam(organizationId)
  ])
  return calculateTimesheetsSetupStatus(clients, projects, activities, team)
}

export const setTeamTariff = async (organizationId: string, userId: string, hourlyRateMinor: number) => {
  const member = (await listPortalOrganizationMembers(organizationId)).find((item) => item.id === userId)
  if (!member) {
    throw createError({ statusCode: 404, message: 'Team member not found' })
  }
  const [row] = await db
    .insert(teamTariff)
    .values({
      id: nanoid(),
      organizationId,
      userId,
      hourlyRateMinor
    })
    .onConflictDoUpdate({
      target: [teamTariff.organizationId, teamTariff.userId],
      set: { hourlyRateMinor, updatedAt: new Date() }
    })
    .returning()
  return row
}

const hydrateProjects = async (
  organizationId: string,
  projects: Array<typeof project.$inferSelect>
): Promise<ProjectDto[]> => {
  if (!projects.length) {
    return []
  }
  const ids = projects.map((item) => item.id)
  const [clients, providerOrganizations, assignments, rates] = await Promise.all([
    listClients(organizationId),
    db
      .select({ id: organization.id, name: organization.name })
      .from(organization)
      .where(eq(organization.id, organizationId)),
    db.select().from(projectActivity).where(inArray(projectActivity.projectId, ids)),
    db.select().from(projectPersonTariff).where(inArray(projectPersonTariff.projectId, ids))
  ])
  const clientNames = new Map(clients.map((item) => [item.organizationId, item.name]))
  const providerName = providerOrganizations[0]?.name ?? 'Unknown organization'
  return projects.map((item) => ({
    id: item.id,
    clientOrganizationId: item.clientOrganizationId,
    clientName:
      item.clientOrganizationId === organizationId
        ? providerName
        : (clientNames.get(item.clientOrganizationId) ?? 'Unknown client'),
    internal: item.clientOrganizationId === organizationId,
    name: item.name,
    code: item.code,
    status: item.status,
    startsOn: item.startsOn,
    endsOn: item.endsOn,
    budgetMinutes: item.budgetMinutes,
    budgetMinor: item.budgetMinor,
    activityTypeIds: assignments.filter((link) => link.projectId === item.id).map((link) => link.activityTypeId),
    personRates: Object.fromEntries(
      rates.filter((rate) => rate.projectId === item.id).map((rate) => [rate.userId, rate.hourlyRateMinor])
    )
  }))
}

export const listProjects = async (organizationId: string): Promise<ProjectDto[]> => {
  const projects = await db
    .select()
    .from(project)
    .where(eq(project.organizationId, organizationId))
    .orderBy(desc(project.status), asc(project.name))
  return hydrateProjects(organizationId, projects)
}

export const getProject = async (organizationId: string, id: string): Promise<ProjectDto | null> => {
  const projects = await db
    .select()
    .from(project)
    .where(and(eq(project.id, id), eq(project.organizationId, organizationId)))
    .limit(1)
  return (await hydrateProjects(organizationId, projects))[0] ?? null
}

export const createProject = async (
  organizationId: string,
  input: {
    clientOrganizationId: string
    name: string
    code?: string | null
    startsOn?: string | null
    endsOn?: string | null
    budgetMinutes?: number | null
    budgetMinor?: number | null
    activityTypeIds: string[]
  }
) => {
  await ensureTimesheetClientSettings(organizationId, input.clientOrganizationId)
  const validActivities = await listActivities(organizationId)
  if (hasInvalidProjectActivityAssignments(input.activityTypeIds, validActivities)) {
    throw createError({ statusCode: 400, message: 'Invalid activity type assignment' })
  }
  return db.transaction(async (tx) => {
    const [created] = await tx
      .insert(project)
      .values({
        id: nanoid(),
        organizationId,
        clientOrganizationId: input.clientOrganizationId,
        name: input.name,
        code: input.code,
        startsOn: input.startsOn,
        endsOn: input.endsOn,
        budgetMinutes: input.budgetMinutes,
        budgetMinor: input.budgetMinor
      })
      .returning()
    if (!created) {
      throw createError({ statusCode: 500, message: 'Failed to create project' })
    }
    await tx.insert(projectActivity).values(
      input.activityTypeIds.map((activityTypeId) => ({
        id: nanoid(),
        projectId: created.id,
        activityTypeId
      }))
    )
    return created
  })
}

export const updateProject = async (
  organizationId: string,
  id: string,
  input: Record<string, unknown> & {
    activityTypeIds?: string[]
    personRates?: Record<string, number>
  }
) => {
  const { activityTypeIds, personRates, ...projectValues } = input
  if (typeof projectValues.clientOrganizationId === 'string') {
    await ensureTimesheetClientSettings(organizationId, projectValues.clientOrganizationId)
  }
  return db.transaction(async (tx) => {
    const projectFilter = and(eq(project.id, id), eq(project.organizationId, organizationId))
    const [updated] =
      Object.keys(projectValues).length > 0
        ? await tx.update(project).set(projectValues).where(projectFilter).returning()
        : await tx.select().from(project).where(projectFilter).limit(1)
    if (!updated) {
      throw createError({ statusCode: 404, message: 'Project not found' })
    }
    if (activityTypeIds) {
      const [valid, existingAssignments] = await Promise.all([
        tx
          .select({ id: activityType.id, active: activityType.active })
          .from(activityType)
          .where(eq(activityType.organizationId, organizationId)),
        tx
          .select({ activityTypeId: projectActivity.activityTypeId })
          .from(projectActivity)
          .where(eq(projectActivity.projectId, id))
      ])
      if (
        hasInvalidProjectActivityAssignments(
          activityTypeIds,
          valid,
          existingAssignments.map((assignment) => assignment.activityTypeId)
        )
      ) {
        throw createError({ statusCode: 400, message: 'Invalid activity type assignment' })
      }
      await tx.delete(projectActivity).where(eq(projectActivity.projectId, id))
      if (activityTypeIds.length) {
        await tx.insert(projectActivity).values(
          activityTypeIds.map((activityTypeId) => ({
            id: nanoid(),
            projectId: id,
            activityTypeId
          }))
        )
      }
    }
    if (personRates) {
      const members = await listPortalOrganizationMembers(organizationId)
      if (Object.keys(personRates).some((userId) => !members.some((member) => member.id === userId))) {
        throw createError({ statusCode: 400, message: 'Invalid project tariff member' })
      }
      await tx.delete(projectPersonTariff).where(eq(projectPersonTariff.projectId, id))
      const values = Object.entries(personRates).map(([userId, hourlyRateMinor]) => ({
        id: nanoid(),
        projectId: id,
        userId,
        hourlyRateMinor
      }))
      if (values.length) {
        await tx.insert(projectPersonTariff).values(values)
      }
    }
    return updated
  })
}

const findOwnedProject = async (organizationId: string, id: string) => {
  const [selectedProject] = await db
    .select({
      id: project.id,
      name: project.name
    })
    .from(project)
    .where(and(eq(project.id, id), eq(project.organizationId, organizationId)))
    .limit(1)
  if (!selectedProject) {
    throw createError({ statusCode: 404, message: 'Project not found' })
  }
  return selectedProject
}

export const getProjectDeletionEligibility = async (organizationId: string, id: string) => {
  const selectedProject = await findOwnedProject(organizationId, id)
  const [existingEntry] = await db
    .select({ id: timeEntry.id })
    .from(timeEntry)
    .where(and(eq(timeEntry.organizationId, organizationId), eq(timeEntry.projectId, id)))
    .limit(1)
  return {
    projectId: selectedProject.id,
    projectName: selectedProject.name,
    canDelete: !existingEntry
  }
}

export const deleteProject = async (organizationId: string, id: string, projectName: string) =>
  db.transaction(async (tx) => {
    const [selectedProject] = await tx
      .select({
        id: project.id,
        name: project.name
      })
      .from(project)
      .where(and(eq(project.id, id), eq(project.organizationId, organizationId)))
      .limit(1)
    if (!selectedProject) {
      throw createError({ statusCode: 404, message: 'Project not found' })
    }
    if (selectedProject.name !== projectName) {
      throw createError({ statusCode: 400, message: 'Project name does not match' })
    }

    const [existingEntry] = await tx
      .select({ id: timeEntry.id })
      .from(timeEntry)
      .where(and(eq(timeEntry.organizationId, organizationId), eq(timeEntry.projectId, id)))
      .limit(1)
    if (existingEntry) {
      throw createError({ statusCode: 409, message: 'Projects with existing time entries cannot be deleted' })
    }

    await tx.delete(project).where(and(eq(project.id, id), eq(project.organizationId, organizationId)))
    return { deleted: true }
  })

const resolveEntryContext = async (
  organizationId: string,
  userId: string,
  projectId: string,
  activityTypeId: string
) => {
  const [settings, projects, activities, tariffs, overrides] = await Promise.all([
    ensureSettings(organizationId),
    listProjects(organizationId),
    listActivities(organizationId),
    db
      .select()
      .from(teamTariff)
      .where(and(eq(teamTariff.organizationId, organizationId), eq(teamTariff.userId, userId))),
    db
      .select()
      .from(projectPersonTariff)
      .where(and(eq(projectPersonTariff.projectId, projectId), eq(projectPersonTariff.userId, userId)))
  ])
  const selectedProject = projects.find((item) => item.id === projectId && item.status === 'ACTIVE')
  const selectedActivity = activities.find((item) => item.id === activityTypeId && item.active)
  if (!selectedProject) {
    throw createError({ statusCode: 400, message: 'Project is unavailable' })
  }
  if (!selectedActivity || !selectedProject.activityTypeIds.includes(activityTypeId)) {
    throw createError({ statusCode: 400, message: 'Activity is unavailable for this project' })
  }
  const rate = selectedActivity.billable ? (overrides[0]?.hourlyRateMinor ?? tariffs[0]?.hourlyRateMinor) : 0
  if (selectedActivity.billable && rate === undefined) {
    throw createError({
      statusCode: 422,
      message: 'No billable tariff is configured',
      data: { code: TIMESHEET_ERROR_CODES.tariffRequired }
    })
  }
  return {
    clientOrganizationId: selectedProject.clientOrganizationId,
    billableSnapshot: selectedActivity.billable,
    hourlyRateMinorSnapshot: rate ?? 0,
    currencySnapshot: settings.currency
  }
}

const requireEditableWeek = (week: WeeklyTimesheetRecord) => {
  if (!['DRAFT', 'REJECTED'].includes(week.status)) {
    throw createError({ statusCode: 409, message: 'Submitted or approved time cannot be changed' })
  }
}

export const getBootstrap = async (
  organizationId: string,
  userId: string,
  dateString?: string
): Promise<TimesheetBootstrapDto> => {
  const week = await ensureWeek(organizationId, userId, dateString)
  const [settings, clients, projects, activities, team, entries] = await Promise.all([
    ensureSettings(organizationId),
    listClients(organizationId),
    listProjects(organizationId),
    listActivities(organizationId),
    listTeam(organizationId),
    db
      .select()
      .from(timeEntry)
      .where(eq(timeEntry.weeklyTimesheetId, week.id))
      .orderBy(asc(timeEntry.entryDate), asc(timeEntry.createdAt))
  ])
  const canEnterTime = team.find((item) => item.id === userId)?.canEnterTime ?? true
  const setupStatus = calculateTimesheetsSetupStatus(clients, projects, activities, team)
  return {
    settings: {
      currency: settings.currency,
      timezone: settings.timezone,
      weekStartsOn: settings.weekStartsOn,
      internalApprovalsEnabled: settings.internalApprovalsEnabled
    },
    clients,
    projects,
    activities,
    team,
    week: toWeekDto(week, entries),
    canEnterTime,
    setupStatus
  }
}

export const createEntry = async (
  organizationId: string,
  userId: string,
  input: {
    projectId: string
    activityTypeId: string
    entryDate: string
    durationMinutes: number
    note?: string | null
  }
) => {
  await requireMemberCanEnterTime(organizationId, userId)
  const week = await ensureWeek(organizationId, userId, input.entryDate)
  requireEditableWeek(week)
  if (input.entryDate < week.weekStartsOn || input.entryDate > addIsoDays(week.weekStartsOn, 6)) {
    throw createError({ statusCode: 400, message: 'Entry date is outside the selected week' })
  }
  const snapshots = await resolveEntryContext(organizationId, userId, input.projectId, input.activityTypeId)
  const [created] = await db
    .insert(timeEntry)
    .values({
      id: nanoid(),
      organizationId,
      weeklyTimesheetId: week.id,
      userId,
      ...input,
      ...snapshots
    })
    .returning()
  if (!created) {
    throw createError({ statusCode: 500, message: 'Failed to create entry' })
  }
  return toEntryDto(created)
}

export const updateEntry = async (
  organizationId: string,
  userId: string,
  id: string,
  input: Partial<{
    projectId: string
    activityTypeId: string
    entryDate: string
    durationMinutes: number
    note: string | null
  }>
) => {
  await requireMemberCanEnterTime(organizationId, userId)
  const [current] = await db
    .select()
    .from(timeEntry)
    .where(and(eq(timeEntry.id, id), eq(timeEntry.organizationId, organizationId), eq(timeEntry.userId, userId)))
    .limit(1)
  if (!current) {
    throw createError({ statusCode: 404, message: 'Time entry not found' })
  }
  const [week] = await db
    .select()
    .from(weeklyTimesheet)
    .where(eq(weeklyTimesheet.id, current.weeklyTimesheetId))
    .limit(1)
  if (!week) {
    throw createError({ statusCode: 404, message: 'Timesheet week not found' })
  }
  requireEditableWeek(week)
  if (current.timerStartedAt) {
    throw createError({ statusCode: 409, message: 'Stop the timer before editing' })
  }
  const projectId = input.projectId ?? current.projectId
  const activityTypeId = input.activityTypeId ?? current.activityTypeId
  const entryDate = input.entryDate ?? current.entryDate
  if (entryDate < week.weekStartsOn || entryDate > addIsoDays(week.weekStartsOn, 6)) {
    throw createError({ statusCode: 400, message: 'Entry date is outside the selected week' })
  }
  const snapshots = await resolveEntryContext(organizationId, userId, projectId, activityTypeId)
  const [updated] = await db
    .update(timeEntry)
    .set({ ...input, ...snapshots })
    .where(eq(timeEntry.id, id))
    .returning()
  if (!updated) {
    throw createError({ statusCode: 500, message: 'Failed to update entry' })
  }
  return toEntryDto(updated)
}

export const deleteEntry = async (organizationId: string, userId: string, id: string) => {
  await requireMemberCanEnterTime(organizationId, userId)
  const [current] = await db
    .select()
    .from(timeEntry)
    .where(and(eq(timeEntry.id, id), eq(timeEntry.organizationId, organizationId), eq(timeEntry.userId, userId)))
    .limit(1)
  if (!current) {
    throw createError({ statusCode: 404, message: 'Time entry not found' })
  }
  const [week] = await db
    .select()
    .from(weeklyTimesheet)
    .where(eq(weeklyTimesheet.id, current.weeklyTimesheetId))
    .limit(1)
  if (!week) {
    throw createError({ statusCode: 404, message: 'Timesheet week not found' })
  }
  requireEditableWeek(week)
  await db.delete(timeEntry).where(eq(timeEntry.id, id))
}

export const startTimer = async (
  organizationId: string,
  userId: string,
  input: { projectId: string; activityTypeId: string; entryDate: string; note?: string | null }
) => {
  await requireMemberCanEnterTime(organizationId, userId)
  const [running] = await db
    .select()
    .from(timeEntry)
    .where(
      and(
        eq(timeEntry.organizationId, organizationId),
        eq(timeEntry.userId, userId),
        isNotNull(timeEntry.timerStartedAt)
      )
    )
    .limit(1)
  if (running) {
    throw createError({ statusCode: 409, message: 'Another timer is already running' })
  }
  const week = await ensureWeek(organizationId, userId, input.entryDate)
  requireEditableWeek(week)
  const snapshots = await resolveEntryContext(organizationId, userId, input.projectId, input.activityTypeId)
  const [created] = await db
    .insert(timeEntry)
    .values({
      id: nanoid(),
      organizationId,
      weeklyTimesheetId: week.id,
      userId,
      ...input,
      durationMinutes: 0,
      timerStartedAt: new Date(),
      ...snapshots
    })
    .returning()
  if (!created) {
    throw createError({ statusCode: 500, message: 'Failed to start timer' })
  }
  return toEntryDto(created)
}

export const stopTimer = async (organizationId: string, userId: string) => {
  await requireMemberCanEnterTime(organizationId, userId)
  const [running] = await db
    .select()
    .from(timeEntry)
    .where(
      and(
        eq(timeEntry.organizationId, organizationId),
        eq(timeEntry.userId, userId),
        isNotNull(timeEntry.timerStartedAt)
      )
    )
    .limit(1)
  if (!running?.timerStartedAt) {
    throw createError({ statusCode: 404, message: 'No timer is running' })
  }
  const elapsed = Math.max(1, Math.round((Date.now() - running.timerStartedAt.getTime()) / 60_000))
  const [updated] = await db
    .update(timeEntry)
    .set({
      durationMinutes: elapsed,
      timerStartedAt: null
    })
    .where(eq(timeEntry.id, running.id))
    .returning()
  if (!updated) {
    throw createError({ statusCode: 500, message: 'Failed to stop timer' })
  }
  return toEntryDto(updated)
}

export const submitWeek = async (organizationId: string, userId: string, weekId: string) =>
  db.transaction(async (tx) => {
    await requireMemberCanEnterTime(organizationId, userId)
    const [week] = await tx
      .select()
      .from(weeklyTimesheet)
      .where(
        and(
          eq(weeklyTimesheet.id, weekId),
          eq(weeklyTimesheet.organizationId, organizationId),
          eq(weeklyTimesheet.userId, userId)
        )
      )
      .limit(1)
    if (!week) {
      throw createError({ statusCode: 404, message: 'Timesheet week not found' })
    }
    requireEditableWeek(week)
    const entries = await tx.select().from(timeEntry).where(eq(timeEntry.weeklyTimesheetId, week.id))
    if (!entries.length) {
      throw createError({ statusCode: 422, message: 'An empty week cannot be submitted' })
    }
    if (entries.some((entry) => entry.timerStartedAt)) {
      throw createError({ statusCode: 409, message: 'Stop the running timer before submitting' })
    }
    const [workspace, memberSetting, assignment] = await Promise.all([
      tx
        .select({ enabled: workspaceSettings.internalApprovalsEnabled })
        .from(workspaceSettings)
        .where(eq(workspaceSettings.organizationId, organizationId))
        .limit(1),
      tx
        .select({ required: teamMemberSettings.internalApprovalRequired })
        .from(teamMemberSettings)
        .where(and(eq(teamMemberSettings.organizationId, organizationId), eq(teamMemberSettings.userId, userId)))
        .limit(1),
      tx
        .select({ id: internalApproverAssignment.id })
        .from(internalApproverAssignment)
        .where(
          and(
            eq(internalApproverAssignment.organizationId, organizationId),
            eq(internalApproverAssignment.submitterUserId, userId)
          )
        )
        .limit(1)
    ])
    const requiresApproval = (workspace[0]?.enabled ?? true) && (memberSetting[0]?.required ?? true)
    if (requiresApproval && !assignment.length) {
      throw createError({
        statusCode: 409,
        message: 'No internal approver is configured for this member',
        data: { code: TIMESHEET_ERROR_CODES.internalApproverRequired }
      })
    }
    const now = new Date()
    const [updated] = await tx
      .update(weeklyTimesheet)
      .set({
        status: requiresApproval ? 'SUBMITTED' : 'APPROVED',
        submittedAt: now,
        reviewedAt: requiresApproval ? null : now,
        reviewedById: null,
        rejectionComment: null
      })
      .where(eq(weeklyTimesheet.id, week.id))
      .returning()
    await tx.insert(timesheetApprovalHistory).values({
      id: nanoid(),
      weeklyTimesheetId: week.id,
      action: 'SUBMITTED',
      actorUserId: userId
    })
    if (!requiresApproval) {
      await tx.insert(timesheetApprovalHistory).values({
        id: nanoid(),
        weeklyTimesheetId: week.id,
        action: 'APPROVED',
        actorUserId: userId,
        comment: 'Automatically approved because internal approval is disabled'
      })
      const representedClients = await tx
        .selectDistinct({ clientOrganizationId: timeEntry.clientOrganizationId })
        .from(timeEntry)
        .innerJoin(
          workspaceClient,
          and(
            eq(workspaceClient.workspaceOrganizationId, organizationId),
            eq(workspaceClient.clientOrganizationId, timeEntry.clientOrganizationId),
            eq(workspaceClient.accessMode, 'REVIEW')
          )
        )
        .where(eq(timeEntry.weeklyTimesheetId, week.id))
      if (representedClients.length) {
        await tx
          .insert(timesheetClientReview)
          .values(
            representedClients.map((item) => ({
              id: nanoid(),
              weeklyTimesheetId: week.id,
              clientOrganizationId: item.clientOrganizationId,
              status: 'PENDING' as const
            }))
          )
          .onConflictDoNothing()
      }
    }
    return updated
  })

export const listApprovalQueue = async (
  organizationId: string,
  approverUserId: string
): Promise<ApprovalQueueItemDto[]> => {
  const [workspace] = await db
    .select({ enabled: workspaceSettings.internalApprovalsEnabled })
    .from(workspaceSettings)
    .where(eq(workspaceSettings.organizationId, organizationId))
    .limit(1)
  if (!workspace?.enabled) {
    return []
  }
  const assignments = await db
    .select({ submitterUserId: internalApproverAssignment.submitterUserId })
    .from(internalApproverAssignment)
    .where(
      and(
        eq(internalApproverAssignment.organizationId, organizationId),
        eq(internalApproverAssignment.approverUserId, approverUserId)
      )
    )
  const submitterIds = assignments.map((item) => item.submitterUserId)
  if (!submitterIds.length) {
    return []
  }
  const [weeks, members, settings] = await Promise.all([
    db
      .select()
      .from(weeklyTimesheet)
      .where(
        and(
          eq(weeklyTimesheet.organizationId, organizationId),
          inArray(weeklyTimesheet.userId, submitterIds),
          inArray(weeklyTimesheet.status, ['SUBMITTED', 'APPROVED', 'REJECTED'])
        )
      )
      .orderBy(desc(weeklyTimesheet.weekStartsOn)),
    listPortalOrganizationMembers(organizationId),
    ensureSettings(organizationId)
  ])
  if (!weeks.length) {
    return []
  }
  const entries = await db
    .select()
    .from(timeEntry)
    .where(
      inArray(
        timeEntry.weeklyTimesheetId,
        weeks.map((week) => week.id)
      )
    )
    .orderBy(asc(timeEntry.entryDate), asc(timeEntry.createdAt))
  const clientReviews = await db
    .select()
    .from(timesheetClientReview)
    .where(
      inArray(
        timesheetClientReview.weeklyTimesheetId,
        weeks.map((week) => week.id)
      )
    )
  const names = new Map(members.map((member) => [member.id, member.name]))
  return weeks.map((week) => {
    const weekEntries = entries.filter((entry) => entry.weeklyTimesheetId === week.id)
    return {
      id: week.id,
      userId: week.userId,
      userName: names.get(week.userId) ?? 'Unknown member',
      weekStartsOn: week.weekStartsOn,
      status: week.status,
      totalMinutes: weekEntries.reduce((sum, entry) => sum + entry.durationMinutes, 0),
      billableMinutes: weekEntries
        .filter((entry) => entry.billableSnapshot)
        .reduce((sum, entry) => sum + entry.durationMinutes, 0),
      billableAmountMinor: weekEntries.reduce(
        (sum, entry) => sum + Math.round((entry.durationMinutes * entry.hourlyRateMinorSnapshot) / 60),
        0
      ),
      currency: settings.currency,
      submittedAt: week.submittedAt?.toISOString() ?? null,
      entries: weekEntries.map(toEntryDto),
      clientReviews: clientReviews
        .filter((review) => review.weeklyTimesheetId === week.id)
        .map((review) => ({
          clientOrganizationId: review.clientOrganizationId,
          status: review.status,
          comment: review.comment
        }))
    }
  })
}

export const reviewWeek = async (
  organizationId: string,
  actorUserId: string,
  weekId: string,
  action: 'APPROVE' | 'REJECT' | 'REOPEN',
  comment?: string | null
) =>
  db.transaction(async (tx) => {
    const [workspace] = await tx
      .select({ enabled: workspaceSettings.internalApprovalsEnabled })
      .from(workspaceSettings)
      .where(eq(workspaceSettings.organizationId, organizationId))
      .limit(1)
    if (!workspace?.enabled) {
      throw createError({
        statusCode: 403,
        message: 'Internal approvals are disabled',
        data: { code: TIMESHEET_ERROR_CODES.internalApprovalUnauthorized }
      })
    }
    const [week] = await tx
      .select()
      .from(weeklyTimesheet)
      .where(and(eq(weeklyTimesheet.id, weekId), eq(weeklyTimesheet.organizationId, organizationId)))
      .limit(1)
    if (!week) {
      throw createError({ statusCode: 404, message: 'Timesheet week not found' })
    }
    const [assignment] = await tx
      .select({ id: internalApproverAssignment.id })
      .from(internalApproverAssignment)
      .where(
        and(
          eq(internalApproverAssignment.organizationId, organizationId),
          eq(internalApproverAssignment.submitterUserId, week.userId),
          eq(internalApproverAssignment.approverUserId, actorUserId)
        )
      )
      .limit(1)
    if (!assignment) {
      throw createError({
        statusCode: 403,
        message: 'You are not assigned to approve this member',
        data: { code: TIMESHEET_ERROR_CODES.internalApprovalUnauthorized }
      })
    }
    if (action !== 'REOPEN' && week.status !== 'SUBMITTED') {
      throw createError({
        statusCode: 409,
        message: 'Only submitted weeks can be reviewed',
        data: { code: TIMESHEET_ERROR_CODES.internalApprovalStale }
      })
    }
    if (action === 'REOPEN' && week.status !== 'APPROVED') {
      throw createError({
        statusCode: 409,
        message: 'Only approved weeks can be reopened',
        data: { code: TIMESHEET_ERROR_CODES.internalApprovalStale }
      })
    }
    if (action === 'REOPEN') {
      const entries = await tx
        .select({ id: timeEntry.id })
        .from(timeEntry)
        .where(eq(timeEntry.weeklyTimesheetId, week.id))
      await assertTimeEntriesReopenable(
        organizationId,
        entries.map((entry) => entry.id)
      )
    }
    const now = new Date()
    const nextStatus = action === 'APPROVE' ? 'APPROVED' : action === 'REJECT' ? 'REJECTED' : 'DRAFT'
    const expectedStatus = action === 'REOPEN' ? 'APPROVED' : 'SUBMITTED'
    const [updated] = await tx
      .update(weeklyTimesheet)
      .set({
        status: nextStatus,
        reviewedAt: action === 'REOPEN' ? null : now,
        reviewedById: action === 'REOPEN' ? null : actorUserId,
        rejectionComment: action === 'REJECT' ? comment : null
      })
      .where(and(eq(weeklyTimesheet.id, week.id), eq(weeklyTimesheet.status, expectedStatus)))
      .returning()
    if (!updated) {
      throw createError({
        statusCode: 409,
        message: 'This timesheet review has already changed',
        data: { code: TIMESHEET_ERROR_CODES.internalApprovalStale }
      })
    }
    await tx.insert(timesheetApprovalHistory).values({
      id: nanoid(),
      weeklyTimesheetId: week.id,
      action: action === 'APPROVE' ? 'APPROVED' : action === 'REJECT' ? 'REJECTED' : 'REOPENED',
      actorUserId,
      comment
    })
    if (action === 'APPROVE') {
      const representedClients = await tx
        .selectDistinct({ clientOrganizationId: timeEntry.clientOrganizationId })
        .from(timeEntry)
        .innerJoin(
          workspaceClient,
          and(
            eq(workspaceClient.workspaceOrganizationId, organizationId),
            eq(workspaceClient.clientOrganizationId, timeEntry.clientOrganizationId),
            eq(workspaceClient.accessMode, 'REVIEW')
          )
        )
        .where(eq(timeEntry.weeklyTimesheetId, week.id))
      if (representedClients.length) {
        await tx
          .insert(timesheetClientReview)
          .values(
            representedClients.map((item) => ({
              id: nanoid(),
              weeklyTimesheetId: week.id,
              clientOrganizationId: item.clientOrganizationId,
              status: 'PENDING' as const
            }))
          )
          .onConflictDoNothing()
      }
    }
    if (action === 'REOPEN') {
      await tx
        .update(timesheetClientReview)
        .set({
          status: 'PENDING',
          reviewerUserId: null,
          comment: null,
          reviewedAt: null,
          version: sql`${timesheetClientReview.version} + 1`,
          updatedAt: now
        })
        .where(eq(timesheetClientReview.weeklyTimesheetId, week.id))
    }
    return updated
  })

export const getReport = async (organizationId: string, filters: ReportQuery): Promise<TimesheetReportDto> => {
  const conditions = [eq(timeEntry.organizationId, organizationId)]
  if (filters.from) {
    conditions.push(gte(timeEntry.entryDate, filters.from))
  }
  if (filters.to) {
    conditions.push(lte(timeEntry.entryDate, filters.to))
  }
  if (filters.projectId) {
    conditions.push(eq(timeEntry.projectId, filters.projectId))
  }
  if (filters.userId) {
    conditions.push(eq(timeEntry.userId, filters.userId))
  }
  if (filters.activityTypeId) {
    conditions.push(eq(timeEntry.activityTypeId, filters.activityTypeId))
  }
  if (filters.billable !== undefined) {
    conditions.push(eq(timeEntry.billableSnapshot, filters.billable))
  }

  const [entries, projects, activities, members, weeks, settings] = await Promise.all([
    db
      .select()
      .from(timeEntry)
      .where(and(...conditions))
      .orderBy(desc(timeEntry.entryDate)),
    listProjects(organizationId),
    listActivities(organizationId),
    listPortalOrganizationMembers(organizationId),
    db.select().from(weeklyTimesheet).where(eq(weeklyTimesheet.organizationId, organizationId)),
    ensureSettings(organizationId)
  ])
  const projectMap = new Map(projects.map((item) => [item.id, item]))
  const activityMap = new Map(activities.map((item) => [item.id, item]))
  const memberMap = new Map(members.map((item) => [item.id, item]))
  const weekMap = new Map(weeks.map((item) => [item.id, item]))
  const rows: ReportRowDto[] = entries.flatMap((entry) => {
    const selectedProject = projectMap.get(entry.projectId)
    const selectedWeek = weekMap.get(entry.weeklyTimesheetId)
    if (!selectedProject || !selectedWeek) {
      return []
    }
    if (filters.clientOrganizationId && selectedProject.clientOrganizationId !== filters.clientOrganizationId) {
      return []
    }
    if (filters.status && selectedWeek.status !== filters.status) {
      return []
    }
    return [
      {
        entryId: entry.id,
        date: entry.entryDate,
        client: selectedProject.clientName,
        project: selectedProject.name,
        person: memberMap.get(entry.userId)?.name ?? 'Unknown member',
        activity: activityMap.get(entry.activityTypeId)?.name ?? 'Unknown activity',
        minutes: entry.durationMinutes,
        billable: entry.billableSnapshot,
        hourlyRateMinor: entry.hourlyRateMinorSnapshot,
        amountMinor: Math.round((entry.durationMinutes * entry.hourlyRateMinorSnapshot) / 60),
        currency: entry.currencySnapshot,
        status: selectedWeek.status,
        note: entry.note
      }
    ]
  })
  return {
    rows,
    totals: {
      minutes: rows.reduce((sum, row) => sum + row.minutes, 0),
      billableMinutes: rows.filter((row) => row.billable).reduce((sum, row) => sum + row.minutes, 0),
      nonBillableMinutes: rows.filter((row) => !row.billable).reduce((sum, row) => sum + row.minutes, 0),
      billableAmountMinor: rows.reduce((sum, row) => sum + row.amountMinor, 0),
      currency: settings.currency
    }
  }
}

export const updateSettings = async (
  organizationId: string,
  input: Partial<{ currency: string; timezone: string }>
) => {
  await ensureSettings(organizationId)
  const [updated] = await db
    .update(workspaceSettings)
    .set(input)
    .where(eq(workspaceSettings.organizationId, organizationId))
    .returning()
  return updated
}

export const getClientTimesheets = async (
  workspaceClientId: string,
  clientOrganizationId: string,
  userId: string,
  canManageReviewers: boolean
): Promise<ClientTimesheetsDto> => {
  const workspaces = await listClientWorkspaces(clientOrganizationId, userId, canManageReviewers)
  const workspace = workspaces.find((item) => item.id === workspaceClientId)
  if (!workspace) {
    throw createError({ statusCode: 404, message: 'Client workspace not found' })
  }
  if (workspace.accessMode !== 'VIEW') {
    throw createError({ statusCode: 403, message: 'Use the timesheet approvals endpoint for review access' })
  }
  const entries = await db
    .select({
      entry: timeEntry,
      week: weeklyTimesheet,
      projectName: project.name,
      activityName: activityType.name,
      personName: user.name
    })
    .from(timeEntry)
    .innerJoin(weeklyTimesheet, eq(weeklyTimesheet.id, timeEntry.weeklyTimesheetId))
    .innerJoin(project, eq(project.id, timeEntry.projectId))
    .innerJoin(activityType, eq(activityType.id, timeEntry.activityTypeId))
    .innerJoin(user, eq(user.id, timeEntry.userId))
    .where(
      and(
        eq(timeEntry.organizationId, workspace.workspaceOrganizationId),
        eq(timeEntry.clientOrganizationId, clientOrganizationId),
        eq(weeklyTimesheet.status, 'APPROVED')
      )
    )
    .orderBy(desc(weeklyTimesheet.weekStartsOn), asc(timeEntry.entryDate), asc(timeEntry.createdAt))
  const weekIds = [...new Set(entries.map((item) => item.week.id))]
  const reviews = weekIds.length
    ? await db
        .select()
        .from(timesheetClientReview)
        .where(
          and(
            inArray(timesheetClientReview.weeklyTimesheetId, weekIds),
            eq(timesheetClientReview.clientOrganizationId, clientOrganizationId)
          )
        )
    : []
  const [internalHistory, clientHistory] = weekIds.length
    ? await Promise.all([
        db
          .select({ history: timesheetApprovalHistory, actorName: user.name })
          .from(timesheetApprovalHistory)
          .innerJoin(user, eq(user.id, timesheetApprovalHistory.actorUserId))
          .where(
            and(
              inArray(timesheetApprovalHistory.weeklyTimesheetId, weekIds),
              inArray(timesheetApprovalHistory.action, ['SUBMITTED', 'APPROVED', 'REOPENED'])
            )
          ),
        db
          .select({ history: timesheetClientReviewHistory, actorName: user.name })
          .from(timesheetClientReviewHistory)
          .innerJoin(user, eq(user.id, timesheetClientReviewHistory.actorUserId))
          .where(
            and(
              inArray(timesheetClientReviewHistory.weeklyTimesheetId, weekIds),
              eq(timesheetClientReviewHistory.clientOrganizationId, clientOrganizationId)
            )
          )
      ])
    : [[], []]
  const reviewByWeek = new Map(reviews.map((item) => [item.weeklyTimesheetId, item]))
  const slices = weekIds.map((weekId) => {
    const rows = entries.filter((item) => item.week.id === weekId)
    const review = reviewByWeek.get(weekId)
    return {
      weeklyTimesheetId: weekId,
      weekStartsOn: rows[0]!.week.weekStartsOn,
      person: rows[0]!.personName,
      status: review?.status ?? ('PENDING' as const),
      version: review?.version ?? 0,
      comment: review?.comment ?? null,
      reviewedAt: review?.reviewedAt?.toISOString() ?? null,
      entries: rows.map(({ entry, projectName, activityName, personName }) => ({
        id: entry.id,
        date: entry.entryDate,
        project: projectName,
        person: personName,
        activity: activityName,
        minutes: entry.durationMinutes,
        note: entry.note
      })),
      history: [
        ...internalHistory
          .filter((item) => item.history.weeklyTimesheetId === weekId)
          .map((item) => ({
            id: item.history.id,
            action:
              item.history.action === 'SUBMITTED'
                ? ('SUBMITTED' as const)
                : item.history.action === 'REOPENED'
                  ? ('REOPENED' as const)
                  : ('APPROVED_INTERNAL' as const),
            actorName: item.actorName,
            comment: null,
            createdAt: item.history.createdAt.toISOString()
          })),
        ...clientHistory
          .filter((item) => item.history.weeklyTimesheetId === weekId)
          .map((item) => ({
            id: item.history.id,
            action: item.history.action === 'APPROVED' ? ('APPROVED_CLIENT' as const) : ('DISPUTED_CLIENT' as const),
            actorName: item.actorName,
            comment: item.history.comment,
            createdAt: item.history.createdAt.toISOString()
          }))
      ].sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    }
  })
  return { workspace, slices }
}

export const listClientSupplierTimesheets = async (
  clientOrganizationId: string,
  userId: string,
  isAdmin: boolean
): Promise<ClientSupplierTimesheetItemDto[]> => {
  const workspaces = (await listClientWorkspaces(clientOrganizationId, userId, isAdmin)).filter(
    (item) => item.accessMode === 'VIEW'
  )
  const collections = await Promise.all(
    workspaces.map(async (workspace) => {
      const result = await getClientTimesheets(workspace.id, clientOrganizationId, userId, isAdmin)
      return result.slices.map((slice) => ({
        ...slice,
        id: slice.weeklyTimesheetId,
        workspaceClientId: workspace.id,
        supplierName: workspace.workspaceName,
        totalMinutes: slice.entries.reduce((total, entry) => total + entry.minutes, 0)
      }))
    })
  )
  return collections.flat()
}

export const listClientSupplierOptions = async (clientOrganizationId: string, userId: string, isAdmin: boolean) =>
  (await listClientWorkspaces(clientOrganizationId, userId, isAdmin))
    .filter((item) => item.accessMode === 'VIEW')
    .map((item) => ({ id: item.id, name: item.workspaceName }))

export const reviewClientTimesheet = async (
  workspaceClientId: string,
  clientOrganizationId: string,
  actorUserId: string,
  isAdmin: boolean,
  weekId: string,
  action: 'APPROVE' | 'DISPUTE',
  expectedVersion: number,
  comment?: string | null
) =>
  db.transaction(async (tx) => {
    const [link] = await tx
      .select()
      .from(workspaceClient)
      .where(
        and(
          eq(workspaceClient.id, workspaceClientId),
          eq(workspaceClient.clientOrganizationId, clientOrganizationId),
          eq(workspaceClient.accessMode, 'REVIEW')
        )
      )
      .limit(1)
    if (!link) {
      throw createError({ statusCode: 404, message: 'Review-enabled client workspace not found' })
    }
    const [reviewer] = await tx
      .select()
      .from(workspaceClientReviewer)
      .where(
        and(
          eq(workspaceClientReviewer.workspaceClientId, workspaceClientId),
          eq(workspaceClientReviewer.userId, actorUserId)
        )
      )
      .limit(1)
    if (!isAdmin && !reviewer) {
      throw createError({ statusCode: 403, message: 'Client reviewer access required' })
    }
    const [eligible] = await tx
      .select({ id: timeEntry.id })
      .from(timeEntry)
      .innerJoin(weeklyTimesheet, eq(weeklyTimesheet.id, timeEntry.weeklyTimesheetId))
      .where(
        and(
          eq(timeEntry.weeklyTimesheetId, weekId),
          eq(timeEntry.organizationId, link.workspaceOrganizationId),
          eq(timeEntry.clientOrganizationId, clientOrganizationId),
          eq(weeklyTimesheet.status, 'APPROVED')
        )
      )
      .limit(1)
    if (!eligible) {
      throw createError({ statusCode: 404, message: 'Client timesheet slice not found' })
    }
    const now = new Date()
    const [updated] = await tx
      .update(timesheetClientReview)
      .set({
        status: action === 'APPROVE' ? 'APPROVED' : 'DISPUTED',
        reviewerUserId: actorUserId,
        comment: comment ?? null,
        reviewedAt: now,
        version: expectedVersion + 1,
        updatedAt: now
      })
      .where(
        and(
          eq(timesheetClientReview.weeklyTimesheetId, weekId),
          eq(timesheetClientReview.clientOrganizationId, clientOrganizationId),
          eq(timesheetClientReview.status, 'PENDING'),
          eq(timesheetClientReview.version, expectedVersion)
        )
      )
      .returning()
    if (!updated) {
      throw createError({ statusCode: 409, message: 'Client review changed; refresh and try again' })
    }
    await tx.insert(timesheetClientReviewHistory).values({
      id: nanoid(),
      weeklyTimesheetId: weekId,
      clientOrganizationId,
      action: action === 'APPROVE' ? 'APPROVED' : 'DISPUTED',
      actorUserId,
      comment: comment ?? null,
      createdAt: now
    })
    return updated
  })

export const reportToCsv = (report: TimesheetReportDto) => {
  const quote = (value: unknown) => `"${String(value ?? '').replaceAll('"', '""')}"`
  return [
    [
      'Date',
      'Client',
      'Project',
      'Person',
      'Activity',
      'Hours',
      'Billable',
      'Rate',
      'Amount',
      'Currency',
      'Status',
      'Note'
    ],
    ...report.rows.map((row) => [
      row.date,
      row.client,
      row.project,
      row.person,
      row.activity,
      (row.minutes / 60).toFixed(2),
      row.billable ? 'Yes' : 'No',
      (row.hourlyRateMinor / 100).toFixed(2),
      (row.amountMinor / 100).toFixed(2),
      row.currency,
      row.status,
      row.note ?? ''
    ])
  ]
    .map((row) => row.map(quote).join(','))
    .join('\n')
}
