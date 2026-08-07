import { requireFeatureAccess } from '#portal/server/portal'
import { timesheetsFeature } from '#layers/timesheets/shared/feature'
import { getInternalApprovalConfiguration } from '#layers/timesheets/server/utils/timesheet-repository'

export default defineEventHandler(async (event) => {
  const { organizationId } = await requireFeatureAccess(event, timesheetsFeature.policy, 'manage')
  return getInternalApprovalConfiguration(organizationId)
})
