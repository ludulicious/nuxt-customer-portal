import { requireFeatureAccess } from '#portal/server/portal'
import { timesheetsFeature } from '#layers/timesheets/shared/feature'
import { linkClient } from '#layers/timesheets/server/utils/timesheet-repository'
import { clientCreateSchema } from '#layers/timesheets/server/utils/timesheet-validation'

defineRouteMeta({
  openAPI: {
    tags: ['Timesheets'],
operationId: 'timesheetsAdminClientsPost',
    summary: 'Link a timesheet client',
    description: 'Link a timesheet client. Scoped to the active organization and the applicable Timesheets permission.'
  }
})

export default defineEventHandler(async (event) => {
  const { organizationId, session } = await requireFeatureAccess(
    event,
    timesheetsFeature.policy,
    'manage'
  )
  const input = clientCreateSchema.parse(await readBody(event))
  return linkClient(
    organizationId,
    session.user.id,
    session.user.role === 'admin',
    input.organizationId
  )
})
