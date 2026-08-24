import { requireFeatureAccess } from '@nuxt-customer-portal/core/server/portal'
import { timesheetsFeature } from '@nuxt-customer-portal/timesheets/shared/feature'
import { createActivity } from '@nuxt-customer-portal/timesheets/server/utils/timesheet-repository'
import { activityCreateSchema } from '@nuxt-customer-portal/timesheets/server/utils/timesheet-validation'

defineRouteMeta({
  openAPI: {
    tags: ['Timesheets'],
    operationId: 'timesheetsAdminActivitiesPost',
    summary: 'Create a timesheet activity',
    description:
      'Create a timesheet activity. Scoped to the active organization and the applicable Timesheets permission.'
  }
})

export default defineEventHandler(async (event) => {
  const { organizationId } = await requireFeatureAccess(event, timesheetsFeature.policy, 'manage')
  return createActivity(organizationId, activityCreateSchema.parse(await readBody(event)))
})
