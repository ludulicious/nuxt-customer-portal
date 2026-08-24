import { requireFeatureAccess } from '@nuxt-customer-portal/core/server/portal'
import { timesheetsFeature } from '@nuxt-customer-portal/timesheets/shared/feature'
import { stopTimer } from '@nuxt-customer-portal/timesheets/server/utils/timesheet-repository'

defineRouteMeta({
  openAPI: {
    tags: ['Timesheets'],
    operationId: 'timesheetsTimerDelete',
    summary: 'Stop the time tracking timer',
    description:
      'Stop the time tracking timer. Scoped to the active organization and the applicable Timesheets permission.'
  }
})

export default defineEventHandler(async (event) => {
  const { session, organizationId } = await requireFeatureAccess(event, timesheetsFeature.policy, 'update')
  return stopTimer(organizationId, session.user.id)
})
