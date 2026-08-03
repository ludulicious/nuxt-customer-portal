import { requireFeatureAccess } from '#portal/server/portal'
import { timesheetsFeature } from '#layers/timesheets/shared/feature'
import { activityListQuerySchema } from '#layers/timesheets/server/utils/timesheet-validation'
import { listActivitiesPage } from '#layers/timesheets/server/utils/timesheet-admin-listing'

defineRouteMeta({
  openAPI: {
    tags: ['Timesheets'],
operationId: 'timesheetsAdminActivitiesGet',
    summary: 'List timesheet activities',
    description: 'List timesheet activities. Scoped to the active organization and the applicable Timesheets permission.'
  }
})

export default defineEventHandler(async (event) => {
  const { organizationId } = await requireFeatureAccess(event, timesheetsFeature.policy, 'manage')
  return listActivitiesPage(organizationId, activityListQuerySchema.parse(getQuery(event)))
})
