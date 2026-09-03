import { requireActiveOrganizationRole } from '@nuxt-customer-portal/core/server/portal'
import { internalApprovalListQuerySchema } from '@nuxt-customer-portal/timesheets/server/utils/timesheet-validation'
import { listInternalApprovalsPage } from '@nuxt-customer-portal/timesheets/server/utils/timesheet-admin-listing'

export default defineEventHandler(async (event) => {
  const { session, organizationId } = await requireActiveOrganizationRole(event)
  return listInternalApprovalsPage(
    organizationId,
    session.user.id,
    internalApprovalListQuerySchema.parse(getQuery(event))
  )
})
