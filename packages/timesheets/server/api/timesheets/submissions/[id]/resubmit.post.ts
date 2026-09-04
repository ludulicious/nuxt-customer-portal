import { submissionReplySchema } from '@nuxt-customer-portal/timesheets/shared/submission-reply'
import { requireFeatureAccess } from '@nuxt-customer-portal/core/server/portal'
import { timesheetsFeature } from '@nuxt-customer-portal/timesheets/shared/feature'
import { resubmitSubmission } from '@nuxt-customer-portal/timesheets/server/utils/timesheet-repository'

export default defineEventHandler(async (event) => {
  const { organizationId, session } = await requireFeatureAccess(event, timesheetsFeature.policy, 'submit')
  const input = submissionReplySchema.parse((await readBody(event)) ?? {})
  return resubmitSubmission(organizationId, session.user.id, getRouterParam(event, 'id')!, input.reply)
})
