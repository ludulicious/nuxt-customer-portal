import { requireFeatureAccess } from '#portal/server/portal'
import { timesheetsFeature } from '#layers/timesheets/shared/feature'
import { updateInternalApprovalWorkspace } from '#layers/timesheets/server/utils/timesheet-repository'
import { internalApprovalWorkspaceUpdateSchema } from '#layers/timesheets/server/utils/timesheet-validation'

export default defineEventHandler(async (event) => {
  const { organizationId } = await requireFeatureAccess(event, timesheetsFeature.policy, 'manage')
  const input = internalApprovalWorkspaceUpdateSchema.parse(await readBody(event))
  await updateInternalApprovalWorkspace(organizationId, input.enabled)
  return { updated: true }
})
