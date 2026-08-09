import { requireActiveOrganizationRole } from '@nuxt-customer-portal/core/server/portal'
import { getClientTimesheets } from '@nuxt-customer-portal/timesheets/server/utils/timesheet-repository'

export default defineEventHandler(async (event) => {
  const { session, organizationId, role } = await requireActiveOrganizationRole(event)
  return getClientTimesheets(getRouterParam(event, 'workspaceClientId')!, organizationId, session.user.id, role === 'owner' || role === 'admin' || session.user.role === 'admin')
})
