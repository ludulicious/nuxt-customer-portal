import { requireActiveOrganizationRole } from '#portal/server/portal'
import { clientApprovalListQuerySchema } from '#layers/timesheets/server/utils/timesheet-validation'
import { listClientApprovalsPage } from '#layers/timesheets/server/utils/timesheet-admin-listing'

export default defineEventHandler(async (event) => {
  const { session, organizationId, role } = await requireActiveOrganizationRole(event)
  const isAdmin = role === 'owner' || role === 'admin' || session.user.role === 'admin'
  return listClientApprovalsPage(organizationId, session.user.id, isAdmin, clientApprovalListQuerySchema.parse(getQuery(event)))
})
