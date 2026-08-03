import { requireFeatureAccess } from '#portal/server/portal'
import { timesheetsFeature } from '#layers/timesheets/shared/feature'
import { updateActivity } from '#layers/timesheets/server/utils/timesheet-repository'
import { activityUpdateSchema } from '#layers/timesheets/server/utils/timesheet-validation'

defineRouteMeta({
  openAPI: {
    tags: ['Timesheets'],
operationId: 'timesheetsAdminActivitiesByIdPatch',
    summary: 'Update a timesheet activity',
    description: 'Update a timesheet activity. Scoped to the active organization and the applicable Timesheets permission.'
  }
})

export default defineEventHandler(async (event) => {
  const { organizationId } = await requireFeatureAccess(
    event,
    timesheetsFeature.policy,
    'manage'
  )
  return updateActivity(
    organizationId,
    getRouterParam(event, 'id')!,
    activityUpdateSchema.parse(await readBody(event))
  )
})
