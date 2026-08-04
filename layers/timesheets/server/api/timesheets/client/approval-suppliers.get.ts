import { requireActiveOrganizationRole } from '#portal/server/portal'
import { listClientApprovalSuppliers } from '#layers/timesheets/server/utils/timesheet-repository'

export default defineEventHandler(async (event) => {
  const { session, organizationId, role } = await requireActiveOrganizationRole(event)
  const isAdmin = role === 'owner' || role === 'admin' || session.user.role === 'admin'
  return listClientApprovalSuppliers(organizationId, session.user.id, isAdmin)
})
