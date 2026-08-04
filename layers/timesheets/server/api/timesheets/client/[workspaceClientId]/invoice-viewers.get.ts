import { requireActiveOrganizationRole } from '#portal/server/portal'
import { listClientInvoiceViewers } from '#layers/timesheets/server/utils/timesheet-repository'

export default defineEventHandler(async (event) => {
  const { session, organizationId, role } = await requireActiveOrganizationRole(event)
  if (role !== 'owner' && role !== 'admin' && session.user.role !== 'admin') throw createError({ statusCode: 403, message: 'Client organization admin access required' })
  return listClientInvoiceViewers(getRouterParam(event, 'workspaceClientId')!, organizationId)
})
