import { requireActiveOrganizationRole } from '@nuxt-customer-portal/core/server/portal'
import { reviewClientTimesheet } from '@nuxt-customer-portal/timesheets/server/utils/timesheet-repository'
import { clientReviewSchema } from '@nuxt-customer-portal/timesheets/server/utils/timesheet-validation'

export default defineEventHandler(async (event) => {
  const { session, organizationId, role } = await requireActiveOrganizationRole(event)
  const input = clientReviewSchema.parse(await readBody(event))
  return reviewClientTimesheet(
    getRouterParam(event, 'workspaceClientId')!,
    organizationId,
    session.user.id,
    role === 'owner' || role === 'admin' || session.user.role === 'admin',
    getRouterParam(event, 'submissionId')!,
    input.action,
    input.expectedVersion,
    input.comment
  )
})
