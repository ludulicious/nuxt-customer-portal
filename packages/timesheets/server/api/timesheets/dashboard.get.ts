import { selectClientDashboardApprovals } from '@nuxt-customer-portal/timesheets/shared/client-approval-dashboard'
import { and, desc, eq, inArray, lt, sql } from 'drizzle-orm'
import { db, requireActiveOrganizationRole } from '@nuxt-customer-portal/core/server/portal'
import {
  workspaceSettings,
  timesheetSubmission,
  weeklyTimesheet,
  timeEntry
} from '@nuxt-customer-portal/timesheets/server/db/schema/timesheets'
import {
  canMemberEnterTime,
  getBootstrap,
  hasInternalApprovalAssignment,
  listApprovalQueue,
  listClientApprovals,
  listClientReviewerSuppliers,
  listClientSupplierTimesheets,
  listClientWorkspaces
} from '@nuxt-customer-portal/timesheets/server/utils/timesheet-repository'
import type { TimesheetsDashboardDto } from '@nuxt-customer-portal/timesheets/shared/types/timesheet'

export default defineEventHandler(async (event): Promise<TimesheetsDashboardDto> => {
  const { session, organizationId, organizationType, role } = await requireActiveOrganizationRole(event)
  const isAdmin = role === 'owner' || role === 'admin' || session.user.role === 'admin'
  const [settingsRow, clientWorkspaces, memberCanEnterTime] = await Promise.all([
    db
      .select({
        workspaceEnabled: workspaceSettings.workspaceEnabled,
        internalApprovalsEnabled: workspaceSettings.internalApprovalsEnabled,
        currency: workspaceSettings.currency
      })
      .from(workspaceSettings)
      .where(eq(workspaceSettings.organizationId, organizationId))
      .limit(1),
    listClientWorkspaces(organizationId, session.user.id, isAdmin),
    canMemberEnterTime(organizationId, session.user.id)
  ])
  const settings = settingsRow[0]
  const workspaceEnabled = settings?.workspaceEnabled ?? false
  const canEnterTime = workspaceEnabled && memberCanEnterTime
  const reviewWorkspaces = clientWorkspaces.filter((item) => item.accessMode === 'REVIEW')
  const canViewSupplierTime =
    organizationType === 'CLIENT' && clientWorkspaces.some((item) => item.accessMode === 'VIEW')
  const hasInternalApprovals =
    workspaceEnabled &&
    (settings?.internalApprovalsEnabled ?? true) &&
    (await hasInternalApprovalAssignment(organizationId, session.user.id))

  const [bootstrap, approvalQueue, clientApprovals, reviewerSuppliers, supplierTimesheets] = await Promise.all([
    canEnterTime ? getBootstrap(organizationId, session.user.id) : Promise.resolve(null),
    hasInternalApprovals ? listApprovalQueue(organizationId, session.user.id) : Promise.resolve([]),
    reviewWorkspaces.length ? listClientApprovals(organizationId, session.user.id, isAdmin) : Promise.resolve(null),
    isAdmin && reviewWorkspaces.length
      ? listClientReviewerSuppliers(organizationId, session.user.id)
      : Promise.resolve([]),
    canViewSupplierTime ? listClientSupplierTimesheets(organizationId, session.user.id, isAdmin) : Promise.resolve([])
  ])

  const pendingInternal = approvalQueue.filter((item) => item.status === 'SUBMITTED')
  const clientDashboard = selectClientDashboardApprovals(clientApprovals?.items ?? [], session.user.id)
  const unsubmittedEntries = bootstrap?.week.entries.filter((entry) => !entry.submissionId) ?? []
  const unsubmittedDates = unsubmittedEntries.map((entry) => entry.entryDate).sort()

  const previousSubmissions = bootstrap
    ? await db
        .select({
          id: timesheetSubmission.id,
          weekStartsOn: weeklyTimesheet.weekStartsOn,
          periodStartsOn: timesheetSubmission.periodStartsOn,
          periodEndsOn: timesheetSubmission.periodEndsOn,
          status: timesheetSubmission.status,
          totalMinutes: sql<number>`coalesce(sum(${timeEntry.durationMinutes}), 0)`.mapWith(Number)
        })
        .from(timesheetSubmission)
        .innerJoin(weeklyTimesheet, eq(weeklyTimesheet.id, timesheetSubmission.weeklyTimesheetId))
        .leftJoin(timeEntry, eq(timeEntry.submissionId, timesheetSubmission.id))
        .where(
          and(
            eq(timesheetSubmission.organizationId, organizationId),
            eq(timesheetSubmission.userId, session.user.id),
            lt(weeklyTimesheet.weekStartsOn, bootstrap.week.weekStartsOn),
            inArray(timesheetSubmission.status, ['SUBMITTED', 'REJECTED', 'APPROVED'])
          )
        )
        .groupBy(timesheetSubmission.id, weeklyTimesheet.weekStartsOn)
        .orderBy(
          desc(weeklyTimesheet.weekStartsOn),
          desc(timesheetSubmission.periodEndsOn),
          desc(timesheetSubmission.id)
        )
        .limit(5)
    : []

  return {
    ...(bootstrap && {
      myWeek: {
        previousSubmissions,
        projects: [...new Set(bootstrap.week.entries.map((entry) => entry.projectId))].map((id) => {
          const project = bootstrap.projects.find((item) => item.id === id)!
          return {
            id,
            name: project.name,
            clientName: project.clientName,
            totalMinutes: bootstrap.week.entries
              .filter((entry) => entry.projectId === id)
              .reduce((sum, entry) => sum + entry.durationMinutes, 0)
          }
        }),
        weekStartsOn: bootstrap.week.weekStartsOn,
        status: bootstrap.week.submissions.some((item) => item.status === 'REJECTED')
          ? ('REJECTED' as const)
          : bootstrap.week.submissions.some((item) => item.status === 'SUBMITTED')
            ? ('SUBMITTED' as const)
            : bootstrap.week.entries.length > 0 &&
                bootstrap.week.entries.every((item) => item.submissionStatus === 'APPROVED')
              ? ('APPROVED' as const)
              : ('DRAFT' as const),
        totalMinutes: bootstrap.week.entries.reduce((sum, entry) => sum + entry.durationMinutes, 0),
        rejectionComment:
          bootstrap.week.submissions.find((item) => item.status === 'REJECTED')?.rejectionComment ?? null,
        hasRunningTimer: bootstrap.week.entries.some((entry) => Boolean(entry.timerStartedAt)),
        batches: bootstrap.week.submissions.map((submission) => ({
          id: submission.id,
          status: submission.status,
          totalMinutes: bootstrap.week.entries
            .filter((entry) => entry.submissionId === submission.id)
            .reduce((sum, entry) => sum + entry.durationMinutes, 0),
          periodStartsOn: submission.periodStartsOn,
          periodEndsOn: submission.periodEndsOn
        })),
        unsubmitted: unsubmittedEntries.length
          ? {
              totalMinutes: unsubmittedEntries.reduce((sum, entry) => sum + entry.durationMinutes, 0),
              periodStartsOn: unsubmittedDates[0]!,
              periodEndsOn: unsubmittedDates.at(-1)!
            }
          : null
      }
    }),
    ...(hasInternalApprovals && {
      internalApprovals: {
        pendingCount: pendingInternal.length,
        items: approvalQueue
          .slice(0, 5)
          .map(({ id, userName, weekStartsOn, periodStartsOn, periodEndsOn, totalMinutes, submittedAt, status }) => ({
            id,
            userName,
            weekStartsOn,
            periodStartsOn,
            periodEndsOn,
            totalMinutes,
            submittedAt,
            status
          }))
      }
    }),
    ...(reviewWorkspaces.length && {
      clientApprovals: {
        pendingCount: clientDashboard.pendingCount,
        hasHistory: clientDashboard.hasHistory,
        unassignedSupplierCount: reviewerSuppliers.filter((item) => item.reviewerCount === 0).length,
        items: clientDashboard.items.map(
          ({ id, supplierName, person, weekStartsOn, periodStartsOn, periodEndsOn, totalMinutes, status }) => ({
            status,
            id,
            supplierName,
            person,
            weekStartsOn,
            periodStartsOn,
            periodEndsOn,
            totalMinutes
          })
        )
      }
    }),
    ...(canViewSupplierTime && {
      supplierTimesheets: {
        items: supplierTimesheets
          .slice(0, 5)
          .map(({ id, supplierName, person, weekStartsOn, periodStartsOn, periodEndsOn, totalMinutes }) => ({
            id,
            supplierName,
            person,
            weekStartsOn,
            periodStartsOn,
            periodEndsOn,
            totalMinutes
          }))
      }
    })
  }
})
