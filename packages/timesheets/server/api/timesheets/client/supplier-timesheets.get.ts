import { requireActiveOrganizationRole } from '@nuxt-customer-portal/core/server/portal'
import { clientSupplierTimesheetListQuerySchema } from '@nuxt-customer-portal/timesheets/server/utils/timesheet-validation'
import { listClientSupplierTimesheetsPage } from '@nuxt-customer-portal/timesheets/server/utils/timesheet-admin-listing'

export default defineEventHandler(async (event) => {
  const { session, organizationId, role } = await requireActiveOrganizationRole(event)
  const isAdmin = role === 'owner' || role === 'admin' || session.user.role === 'admin'
  return listClientSupplierTimesheetsPage(organizationId, session.user.id, isAdmin, clientSupplierTimesheetListQuerySchema.parse(getQuery(event)))
})
