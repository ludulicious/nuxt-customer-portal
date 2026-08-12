import { eq } from 'drizzle-orm'
import { db, requireActiveOrganizationRole } from '@nuxt-customer-portal/core/server/portal'
import { workspaceSettings } from '@nuxt-customer-portal/timesheets/server/db/schema/timesheets'
import { canMemberEnterTime, hasInternalApprovalAssignment, listApprovalQueue, listClientApprovals, listClientReviewerSuppliers, listClientWorkspaces } from '@nuxt-customer-portal/timesheets/server/utils/timesheet-repository'
import type { TimesheetCapabilitiesDto } from '@nuxt-customer-portal/timesheets/shared/types/timesheet'

export default defineEventHandler(async (event) => {
  const { session, organizationId, organizationType, role } = await requireActiveOrganizationRole(event)
  const isAdmin = role === 'owner' || role === 'admin' || session.user.role === 'admin'
  const [settings, clientWorkspaces, approvals, reviewerSuppliers, memberCanEnterTime] = await Promise.all([
    db.select({ workspaceEnabled: workspaceSettings.workspaceEnabled, invoicingEnabled: workspaceSettings.invoicingEnabled, internalApprovalsEnabled: workspaceSettings.internalApprovalsEnabled }).from(workspaceSettings).where(eq(workspaceSettings.organizationId, organizationId)).limit(1),
    listClientWorkspaces(organizationId, session.user.id, isAdmin),
    listClientApprovals(organizationId, session.user.id, isAdmin),
    isAdmin ? listClientReviewerSuppliers(organizationId, session.user.id) : Promise.resolve([]),
    canMemberEnterTime(organizationId, session.user.id)
  ])
  const reviewWorkspaces = clientWorkspaces.filter(item => item.accessMode === 'REVIEW')
  const invoiceWorkspaces = clientWorkspaces.filter(item => item.invoiceAccessEnabled)
  const workspaceEnabled = settings[0]?.workspaceEnabled ?? false
  const internalApprovals = workspaceEnabled && (settings[0]?.internalApprovalsEnabled ?? true)
    ? await listApprovalQueue(organizationId, session.user.id)
    : []
  const hasInternalApprovalAssignments = workspaceEnabled && (settings[0]?.internalApprovalsEnabled ?? true)
    && await hasInternalApprovalAssignment(organizationId, session.user.id)
  return {
    canEnterTime: workspaceEnabled && memberCanEnterTime,
    canApproveInternalTimesheets: hasInternalApprovalAssignments,
    hasInternalApprovalAssignments,
    canManageTimesheets: isAdmin && workspaceEnabled,
    canReviewClientTimesheets: reviewWorkspaces.length > 0 && (isAdmin || reviewWorkspaces.some(item => item.canReview) || approvals.items.length > 0),
    canInvoice: isAdmin && (settings[0]?.invoicingEnabled ?? false),
    canViewSupplierTime: organizationType === 'CLIENT' && clientWorkspaces.some(item => item.accessMode === 'VIEW'),
    canAccessApprovals: reviewWorkspaces.length > 0 && (isAdmin || reviewWorkspaces.some(item => item.canReview) || approvals.items.length > 0),
    canManageClientReviewers: isAdmin && reviewWorkspaces.length > 0,
    canViewClientInvoices: invoiceWorkspaces.some(item => item.canViewInvoices),
    canManageInvoiceViewers: isAdmin && invoiceWorkspaces.length > 0,
    pendingInternalApprovalCount: internalApprovals.filter(item => item.status === 'SUBMITTED').length,
    pendingClientApprovalCount: approvals.pendingCount,
    unassignedClientReviewerSupplierCount: reviewerSuppliers.filter(item => item.reviewerCount === 0).length
  } satisfies TimesheetCapabilitiesDto
})
