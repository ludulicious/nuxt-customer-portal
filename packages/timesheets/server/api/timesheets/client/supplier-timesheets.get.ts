import { requireActiveOrganizationRole } from '@nuxt-customer-portal/core/server/portal'
import { clientSupplierTimesheetListQuerySchema } from '@nuxt-customer-portal/timesheets/server/utils/timesheet-validation'
import { listClientSupplierTimesheetsPage } from '@nuxt-customer-portal/timesheets/server/utils/timesheet-admin-listing'

export default defineEventHandler(async (event) => {
  const { session, organizationId, organizationType, role } = await requireActiveOrganizationRole(event)
  if (organizationType !== 'CLIENT') throw createError({ statusCode: 403, message: 'Supplier timesheets are only available to client organizations' })
  const isAdmin = role === 'owner' || role === 'admin' || session.user.role === 'admin'
  return listClientSupplierTimesheetsPage(organizationId, session.user.id, isAdmin, clientSupplierTimesheetListQuerySchema.parse(getQuery(event)))
})
