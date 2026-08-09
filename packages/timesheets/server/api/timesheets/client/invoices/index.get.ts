import { requireActiveOrganizationRole } from '@nuxt-customer-portal/core/server/portal'
import { clientInvoiceListQuerySchema } from '@nuxt-customer-portal/timesheets/server/utils/timesheet-validation'
import { listClientInvoicesPage } from '@nuxt-customer-portal/timesheets/server/utils/timesheet-admin-listing'

export default defineEventHandler(async (event) => {
  const { session, organizationId, role } = await requireActiveOrganizationRole(event)
  const isAdmin = role === 'owner' || role === 'admin' || session.user.role === 'admin'
  return listClientInvoicesPage(organizationId, session.user.id, isAdmin, clientInvoiceListQuerySchema.parse(getQuery(event)))
})
