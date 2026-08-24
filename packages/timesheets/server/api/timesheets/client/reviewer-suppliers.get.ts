import { requireActiveOrganizationRole } from '@nuxt-customer-portal/core/server/portal'
import { listClientReviewerSuppliers } from '@nuxt-customer-portal/timesheets/server/utils/timesheet-repository'

export default defineEventHandler(async (event) => {
  const { session, organizationId, role } = await requireActiveOrganizationRole(event)
  if (role !== 'owner' && role !== 'admin' && session.user.role !== 'admin') {
    throw createError({ statusCode: 403, message: 'Client organization admin access required' })
  }
  return listClientReviewerSuppliers(organizationId, session.user.id)
})
