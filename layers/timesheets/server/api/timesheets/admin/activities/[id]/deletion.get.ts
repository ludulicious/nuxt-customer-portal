import { requireFeatureAccess } from '#portal/server/portal'
import { timesheetsFeature } from '#layers/timesheets/shared/feature'
import { getActivityDeletionEligibility } from '#layers/timesheets/server/utils/timesheet-repository'

defineRouteMeta({
  openAPI: {
    tags: ['Timesheets'],
operationId: 'timesheetsAdminActivitiesByIdDeletionGet',
    summary: 'Check activity deletion eligibility',
    description: 'Check activity deletion eligibility. Scoped to the active organization and the applicable Timesheets permission.'
  }
})

export default defineEventHandler(async (event) => {
  const { organizationId } = await requireFeatureAccess(
    event,
    timesheetsFeature.policy,
    'manage'
  )
  return getActivityDeletionEligibility(organizationId, getRouterParam(event, 'id')!)
})
