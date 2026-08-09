import { requireActiveOrganizationRole } from '@nuxt-customer-portal/core/server/portal'
import { setClientInvoiceViewer } from '@nuxt-customer-portal/timesheets/server/utils/timesheet-repository'
import { clientInvoiceViewerUpdateSchema } from '@nuxt-customer-portal/timesheets/server/utils/timesheet-validation'

export default defineEventHandler(async (event) => {
  const { session, organizationId, role } = await requireActiveOrganizationRole(event)
  if (role !== 'owner' && role !== 'admin' && session.user.role !== 'admin') throw createError({ statusCode: 403, message: 'Client organization admin access required' })
  const input = clientInvoiceViewerUpdateSchema.parse(await readBody(event))
  return setClientInvoiceViewer(getRouterParam(event, 'workspaceClientId')!, organizationId, session.user.id, input.userId, input.assigned)
})
