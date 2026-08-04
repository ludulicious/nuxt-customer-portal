import { requireActiveOrganizationRole } from '#portal/server/portal'
import { clientInvoiceListQuerySchema } from '#layers/timesheets/server/utils/timesheet-validation'
import { listClientInvoicesPage } from '#layers/timesheets/server/utils/timesheet-admin-listing'

export default defineEventHandler(async (event) => {
  const { session, organizationId, role } = await requireActiveOrganizationRole(event)
  const isAdmin = role === 'owner' || role === 'admin' || session.user.role === 'admin'
  return listClientInvoicesPage(organizationId, session.user.id, isAdmin, clientInvoiceListQuerySchema.parse(getQuery(event)))
})
