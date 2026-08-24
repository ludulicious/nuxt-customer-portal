import { requireActiveOrganizationRole } from '@nuxt-customer-portal/core/server/portal'
import { listClientSupplierOptions } from '@nuxt-customer-portal/timesheets/server/utils/timesheet-repository'

export default defineEventHandler(async (event) => {
  const { session, organizationId, organizationType, role } = await requireActiveOrganizationRole(event)
  if (organizationType !== 'CLIENT') {
    throw createError({ statusCode: 403, message: 'Supplier timesheets are only available to client organizations' })
  }
  return listClientSupplierOptions(
    organizationId,
    session.user.id,
    role === 'owner' || role === 'admin' || session.user.role === 'admin'
  )
})
