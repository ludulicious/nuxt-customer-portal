import { requireActiveOrganizationRole } from '#portal/server/portal'
import { reviewClientTimesheet } from '#layers/timesheets/server/utils/timesheet-repository'
import { clientReviewSchema } from '#layers/timesheets/server/utils/timesheet-validation'

export default defineEventHandler(async (event) => {
  const { session, organizationId, role } = await requireActiveOrganizationRole(event)
  const input = clientReviewSchema.parse(await readBody(event))
  return reviewClientTimesheet(getRouterParam(event, 'workspaceClientId')!, organizationId, session.user.id, role === 'owner' || role === 'admin' || session.user.role === 'admin', getRouterParam(event, 'weekId')!, input.action, input.expectedVersion, input.comment)
})
