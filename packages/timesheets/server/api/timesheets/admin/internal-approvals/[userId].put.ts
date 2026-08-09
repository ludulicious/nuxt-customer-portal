import { requireFeatureAccess } from '@nuxt-customer-portal/core/server/portal'
import { timesheetsFeature } from '@nuxt-customer-portal/timesheets/shared/feature'
import { updateInternalApprovalMember } from '@nuxt-customer-portal/timesheets/server/utils/timesheet-repository'
import { internalApprovalMemberUpdateSchema } from '@nuxt-customer-portal/timesheets/server/utils/timesheet-validation'

export default defineEventHandler(async (event) => {
  const { organizationId, session } = await requireFeatureAccess(event, timesheetsFeature.policy, 'manage')
  const input = internalApprovalMemberUpdateSchema.parse(await readBody(event))
  await updateInternalApprovalMember(organizationId, session.user.id, getRouterParam(event, 'userId')!, input)
  return { updated: true }
})
