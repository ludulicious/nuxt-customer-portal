import { eq } from 'drizzle-orm'
import { db, requireActiveOrganizationRole } from '#portal/server/portal'
import { workspaceSettings } from '#layers/timesheets/server/db/schema/timesheets'
import { canMemberEnterTime, getBootstrap, hasInternalApprovalAssignment, listApprovalQueue, listClientApprovals, listClientInvoices, listClientReviewerSuppliers, listClientSupplierTimesheets, listClientWorkspaces, listInvoices } from '#layers/timesheets/server/utils/timesheet-repository'
import type { TimesheetsDashboardDto } from '#layers/timesheets/shared/types/timesheet'

export default defineEventHandler(async (event): Promise<TimesheetsDashboardDto> => {
  const { session, organizationId, role } = await requireActiveOrganizationRole(event)
  const isAdmin = role === 'owner' || role === 'admin' || session.user.role === 'admin'
  const [settingsRow, clientWorkspaces, memberCanEnterTime] = await Promise.all([
    db.select({ workspaceEnabled: workspaceSettings.workspaceEnabled, invoicingEnabled: workspaceSettings.invoicingEnabled, internalApprovalsEnabled: workspaceSettings.internalApprovalsEnabled, currency: workspaceSettings.currency })
      .from(workspaceSettings).where(eq(workspaceSettings.organizationId, organizationId)).limit(1),
    listClientWorkspaces(organizationId, session.user.id, isAdmin),
    canMemberEnterTime(organizationId, session.user.id)
  ])
  const settings = settingsRow[0]
  const workspaceEnabled = settings?.workspaceEnabled ?? false
  const canEnterTime = workspaceEnabled && memberCanEnterTime
  const canInvoice = isAdmin && (settings?.invoicingEnabled ?? false)
  const reviewWorkspaces = clientWorkspaces.filter(item => item.accessMode === 'REVIEW')
  const canViewClientInvoices = clientWorkspaces.some(item => item.invoiceAccessEnabled && item.canViewInvoices)
  const canViewSupplierTime = clientWorkspaces.some(item => item.accessMode === 'VIEW')
  const hasInternalApprovals = workspaceEnabled && (settings?.internalApprovalsEnabled ?? true)
    && await hasInternalApprovalAssignment(organizationId, session.user.id)

  const [bootstrap, approvalQueue, clientApprovals, reviewerSuppliers, supplierTimesheets, salesInvoices, receivedInvoices] = await Promise.all([
    canEnterTime ? getBootstrap(organizationId, session.user.id) : Promise.resolve(null),
    hasInternalApprovals ? listApprovalQueue(organizationId, session.user.id) : Promise.resolve([]),
    reviewWorkspaces.length ? listClientApprovals(organizationId, session.user.id, isAdmin) : Promise.resolve(null),
    isAdmin && reviewWorkspaces.length ? listClientReviewerSuppliers(organizationId, session.user.id) : Promise.resolve([]),
    canViewSupplierTime ? listClientSupplierTimesheets(organizationId, session.user.id, isAdmin) : Promise.resolve([]),
    canInvoice ? listInvoices(organizationId) : Promise.resolve([]),
    canViewClientInvoices ? listClientInvoices(organizationId, session.user.id, isAdmin) : Promise.resolve([])
  ])

  const pendingInternal = approvalQueue.filter(item => item.status === 'SUBMITTED')
  const actionableClient = clientApprovals?.items.filter(item => item.status === 'PENDING' && item.canAct) ?? []
  const activeSales = salesInvoices.filter(item => item.status !== 'VOID')
  const visibleReceived = receivedInvoices.filter(item => item.status !== 'PAID')

  return {
    ...(bootstrap && { myWeek: {
      weekStartsOn: bootstrap.week.weekStartsOn,
      status: bootstrap.week.status,
      totalMinutes: bootstrap.week.entries.reduce((sum, entry) => sum + entry.durationMinutes, 0),
      rejectionComment: bootstrap.week.rejectionComment,
      hasRunningTimer: bootstrap.week.entries.some(entry => Boolean(entry.timerStartedAt))
    } }),
    ...(hasInternalApprovals && { internalApprovals: {
      pendingCount: pendingInternal.length,
      items: approvalQueue.slice(0, 5).map(({ id, userName, weekStartsOn, totalMinutes, submittedAt, status }) => ({ id, userName, weekStartsOn, totalMinutes, submittedAt, status }))
    } }),
    ...(reviewWorkspaces.length && { clientApprovals: {
      pendingCount: clientApprovals?.pendingCount ?? 0,
      unassignedSupplierCount: reviewerSuppliers.filter(item => item.reviewerCount === 0).length,
      items: actionableClient.slice(0, 5).map(({ id, supplierName, person, weekStartsOn, totalMinutes }) => ({ id, supplierName, person, weekStartsOn, totalMinutes }))
    } }),
    ...(canViewSupplierTime && { supplierTimesheets: {
      items: supplierTimesheets.slice(0, 5).map(({ id, supplierName, person, weekStartsOn, totalMinutes, billingStatus }) => ({ id, supplierName, person, weekStartsOn, totalMinutes, billingStatus }))
    } }),
    ...(canInvoice && { salesInvoices: {
      currency: settings?.currency ?? 'EUR',
      draftCount: activeSales.filter(item => item.status === 'DRAFT').length,
      issuedCount: activeSales.filter(item => item.status === 'ISSUED').length,
      overdueCount: activeSales.filter(item => item.isOverdue).length,
      outstandingMinor: activeSales.reduce((sum, item) => sum + item.outstandingMinor, 0),
      recent: activeSales.slice(0, 5).map(({ id, number, recipientName, status, dueDate, outstandingMinor, isOverdue }) => ({ id, number, recipientName, status, dueDate, outstandingMinor, isOverdue }))
    } }),
    ...(canViewClientInvoices && { receivedInvoices: {
      currency: visibleReceived[0]?.currency ?? null,
      overdueCount: visibleReceived.filter(item => item.isOverdue).length,
      outstandingMinor: visibleReceived.reduce((sum, item) => sum + item.outstandingMinor, 0),
      recent: receivedInvoices.sort((left, right) => right.issueDate.localeCompare(left.issueDate)).slice(0, 5)
    } })
  }
})
