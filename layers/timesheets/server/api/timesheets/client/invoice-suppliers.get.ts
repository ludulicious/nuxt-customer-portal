import { requireActiveOrganizationRole } from '#portal/server/portal'
import { listClientInvoiceSuppliers } from '#layers/timesheets/server/utils/timesheet-repository'

export default defineEventHandler(async (event) => {
  const { session, organizationId, role } = await requireActiveOrganizationRole(event)
  const isAdmin = role === 'owner' || role === 'admin' || session.user.role === 'admin'
  return listClientInvoiceSuppliers(organizationId, session.user.id, isAdmin)
})
