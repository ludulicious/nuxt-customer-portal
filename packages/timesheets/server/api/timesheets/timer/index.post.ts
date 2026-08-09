import { requireFeatureAccess } from '@nuxt-customer-portal/core/server/portal'
import { timesheetsFeature } from '@nuxt-customer-portal/timesheets/shared/feature'
import { requireTimesheetWorkspace, startTimer } from '@nuxt-customer-portal/timesheets/server/utils/timesheet-repository'
import { timerStartSchema } from '@nuxt-customer-portal/timesheets/server/utils/timesheet-validation'

defineRouteMeta({
  openAPI: {
    tags: ['Timesheets'],
operationId: 'timesheetsTimerPost',
    summary: 'Start the time tracking timer',
    description: 'Start the time tracking timer. Scoped to the active organization and the applicable Timesheets permission.'
  }
})

export default defineEventHandler(async (event) => {
  const { session, organizationId } = await requireFeatureAccess(
    event,
    timesheetsFeature.policy,
    'create'
  )
  await requireTimesheetWorkspace(organizationId)
  return startTimer(
    organizationId,
    session.user.id,
    timerStartSchema.parse(await readBody(event))
  )
})
