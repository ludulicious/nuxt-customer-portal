import { requireFeatureAccess } from '@nuxt-customer-portal/core/server/portal'
import { timesheetsFeature } from '@nuxt-customer-portal/timesheets/shared/feature'
import { updateActivity } from '@nuxt-customer-portal/timesheets/server/utils/timesheet-repository'
import { activityUpdateSchema } from '@nuxt-customer-portal/timesheets/server/utils/timesheet-validation'

defineRouteMeta({
  openAPI: {
    tags: ['Timesheets'],
    operationId: 'timesheetsAdminActivitiesByIdPatch',
    summary: 'Update a timesheet activity',
    description:
      'Update a timesheet activity. Scoped to the active organization and the applicable Timesheets permission.'
  }
})

export default defineEventHandler(async (event) => {
  const { organizationId } = await requireFeatureAccess(event, timesheetsFeature.policy, 'manage')
  return updateActivity(organizationId, getRouterParam(event, 'id')!, activityUpdateSchema.parse(await readBody(event)))
})
