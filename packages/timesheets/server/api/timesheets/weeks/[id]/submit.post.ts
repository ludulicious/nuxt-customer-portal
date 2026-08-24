import { requireFeatureAccess } from '@nuxt-customer-portal/core/server/portal'
import { timesheetsFeature } from '@nuxt-customer-portal/timesheets/shared/feature'
import { submitWeek } from '@nuxt-customer-portal/timesheets/server/utils/timesheet-repository'

defineRouteMeta({
  openAPI: {
    tags: ['Timesheets'],
    operationId: 'timesheetsWeeksByIdSubmitPost',
    summary: 'Submit a timesheet week',
    description: 'Submit a timesheet week. Scoped to the active organization and the applicable Timesheets permission.'
  }
})

export default defineEventHandler(async (event) => {
  const { session, organizationId } = await requireFeatureAccess(event, timesheetsFeature.policy, 'submit')
  return submitWeek(organizationId, session.user.id, getRouterParam(event, 'id')!)
})
