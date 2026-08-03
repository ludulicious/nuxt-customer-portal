import { requireFeatureAccess } from '#portal/server/portal'
import { timesheetsFeature } from '#layers/timesheets/shared/feature'
import { startTimer } from '#layers/timesheets/server/utils/timesheet-repository'
import { timerStartSchema } from '#layers/timesheets/server/utils/timesheet-validation'

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
  return startTimer(
    organizationId,
    session.user.id,
    timerStartSchema.parse(await readBody(event))
  )
})
