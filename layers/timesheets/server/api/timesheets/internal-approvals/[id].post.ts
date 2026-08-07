import { requireActiveOrganizationRole } from '#portal/server/portal'
import { reviewWeek } from '#layers/timesheets/server/utils/timesheet-repository'
import { reviewSchema } from '#layers/timesheets/server/utils/timesheet-validation'

export default defineEventHandler(async (event) => {
  const { session, organizationId } = await requireActiveOrganizationRole(event)
  const input = reviewSchema.parse(await readBody(event))
  return reviewWeek(organizationId, session.user.id, getRouterParam(event, 'id')!, input.action, input.comment)
})
