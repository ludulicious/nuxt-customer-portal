import { requireActiveOrganizationRole } from '#portal/server/portal'
import { listClientWorkspaces } from '#layers/timesheets/server/utils/timesheet-repository'

export default defineEventHandler(async (event) => {
  const { session, organizationId, role } = await requireActiveOrganizationRole(event)
  return listClientWorkspaces(organizationId, session.user.id, role === 'owner' || role === 'admin' || session.user.role === 'admin')
})
