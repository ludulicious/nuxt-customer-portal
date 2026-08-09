import { requireFeatureAccess } from '@nuxt-customer-portal/core/server/portal'
import { timesheetsFeature } from '@nuxt-customer-portal/timesheets/shared/feature'
import { updateInternalApprovalWorkspace } from '@nuxt-customer-portal/timesheets/server/utils/timesheet-repository'
import { internalApprovalWorkspaceUpdateSchema } from '@nuxt-customer-portal/timesheets/server/utils/timesheet-validation'

export default defineEventHandler(async (event) => {
  const { organizationId } = await requireFeatureAccess(event, timesheetsFeature.policy, 'manage')
  const input = internalApprovalWorkspaceUpdateSchema.parse(await readBody(event))
  await updateInternalApprovalWorkspace(organizationId, input.enabled)
  return { updated: true }
})
