import { eq } from 'drizzle-orm'
import { db, requireActiveOrganizationRole } from '#portal/server/portal'
import { workspaceSettings } from '#layers/timesheets/server/db/schema/timesheets'
import { listClientApprovals, listClientReviewerSuppliers, listClientWorkspaces } from '#layers/timesheets/server/utils/timesheet-repository'

export default defineEventHandler(async (event) => {
  const { session, organizationId, role } = await requireActiveOrganizationRole(event)
  const isAdmin = role === 'owner' || role === 'admin' || session.user.role === 'admin'
  const [settings, clientWorkspaces, approvals, reviewerSuppliers] = await Promise.all([
    db.select({ workspaceEnabled: workspaceSettings.workspaceEnabled, invoicingEnabled: workspaceSettings.invoicingEnabled }).from(workspaceSettings).where(eq(workspaceSettings.organizationId, organizationId)).limit(1),
    listClientWorkspaces(organizationId, session.user.id, isAdmin),
    listClientApprovals(organizationId, session.user.id, isAdmin),
    isAdmin ? listClientReviewerSuppliers(organizationId, session.user.id) : Promise.resolve([])
  ])
  const reviewWorkspaces = clientWorkspaces.filter(item => item.accessMode === 'REVIEW')
  return {
    canEnterTime: settings[0]?.workspaceEnabled ?? false,
    canInvoice: settings[0]?.invoicingEnabled ?? false,
    canViewSupplierTime: clientWorkspaces.some(item => item.accessMode === 'VIEW'),
    canAccessApprovals: reviewWorkspaces.length > 0 && (isAdmin || reviewWorkspaces.some(item => item.canReview) || approvals.items.length > 0),
    canManageClientReviewers: isAdmin && reviewWorkspaces.length > 0,
    pendingClientApprovalCount: approvals.pendingCount,
    unassignedClientReviewerSupplierCount: reviewerSuppliers.filter(item => item.reviewerCount === 0).length
  }
})
