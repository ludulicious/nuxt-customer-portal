import { requireFeatureAccess } from '#portal/server/portal'
import { timesheetsFeature } from '#layers/timesheets/shared/feature'
import { reviewWeek } from '#layers/timesheets/server/utils/timesheet-repository'
import { reviewSchema } from '#layers/timesheets/server/utils/timesheet-validation'

defineRouteMeta({
  openAPI: {
    tags: ['Timesheets'],
operationId: 'timesheetsAdminApprovalsByIdPost',
    summary: 'Review a submitted timesheet',
    description: 'Review a submitted timesheet. Scoped to the active organization and the applicable Timesheets permission.'
  }
})

export default defineEventHandler(async (event) => {
  const { session, organizationId } = await requireFeatureAccess(
    event,
    timesheetsFeature.policy,
    'approve'
  )
  const input = reviewSchema.parse(await readBody(event))
  return reviewWeek(
    organizationId,
    session.user.id,
    getRouterParam(event, 'id')!,
    input.action,
    input.comment
  )
})
