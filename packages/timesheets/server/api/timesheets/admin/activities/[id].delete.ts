import { requireFeatureAccess } from '@nuxt-customer-portal/core/server/portal'
import { timesheetsFeature } from '@nuxt-customer-portal/timesheets/shared/feature'
import { deleteActivity } from '@nuxt-customer-portal/timesheets/server/utils/timesheet-repository'
import { activityDeleteSchema } from '@nuxt-customer-portal/timesheets/server/utils/timesheet-validation'

defineRouteMeta({
  openAPI: {
    tags: ['Timesheets'],
    operationId: 'timesheetsAdminActivitiesByIdDelete',
    summary: 'Delete a timesheet activity',
    description:
      'Delete a timesheet activity. Scoped to the active organization and the applicable Timesheets permission.'
  }
})

export default defineEventHandler(async (event) => {
  const { organizationId } = await requireFeatureAccess(event, timesheetsFeature.policy, 'manage')
  const input = activityDeleteSchema.parse(await readBody(event))
  return deleteActivity(organizationId, getRouterParam(event, 'id')!, input.activityName)
})
