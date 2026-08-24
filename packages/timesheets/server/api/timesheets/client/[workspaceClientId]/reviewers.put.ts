import { requireActiveOrganizationRole } from '@nuxt-customer-portal/core/server/portal'
import { setClientReviewer } from '@nuxt-customer-portal/timesheets/server/utils/timesheet-repository'
import { clientReviewerUpdateSchema } from '@nuxt-customer-portal/timesheets/server/utils/timesheet-validation'

export default defineEventHandler(async (event) => {
  const { session, organizationId, role } = await requireActiveOrganizationRole(event)
  if (role !== 'owner' && role !== 'admin' && session.user.role !== 'admin') {
    throw createError({ statusCode: 403, message: 'Client organization admin access required' })
  }
  const input = clientReviewerUpdateSchema.parse(await readBody(event))
  return setClientReviewer(
    getRouterParam(event, 'workspaceClientId')!,
    organizationId,
    session.user.id,
    input.userId,
    input.assigned
  )
})
