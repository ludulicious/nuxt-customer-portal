import { requireFeatureAccess } from '#portal/server/portal'
import { timesheetsFeature } from '#layers/timesheets/shared/feature'
import { deleteActivity } from '#layers/timesheets/server/utils/timesheet-repository'
import { activityDeleteSchema } from '#layers/timesheets/server/utils/timesheet-validation'

defineRouteMeta({
  openAPI: {
    tags: ['Timesheets'],
operationId: 'timesheetsAdminActivitiesByIdDelete',
    summary: 'Delete a timesheet activity',
    description: 'Delete a timesheet activity. Scoped to the active organization and the applicable Timesheets permission.'
  }
})

export default defineEventHandler(async (event) => {
  const { organizationId } = await requireFeatureAccess(
    event,
    timesheetsFeature.policy,
    'manage'
  )
  const input = activityDeleteSchema.parse(await readBody(event))
  return deleteActivity(organizationId, getRouterParam(event, 'id')!, input.activityName)
})
