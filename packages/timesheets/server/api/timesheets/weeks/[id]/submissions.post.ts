import { requireFeatureAccess } from '@nuxt-customer-portal/core/server/portal'
import { timesheetsFeature } from '@nuxt-customer-portal/timesheets/shared/feature'
import { submitWeek } from '@nuxt-customer-portal/timesheets/server/utils/timesheet-repository'
import { submissionCreateSchema } from '@nuxt-customer-portal/timesheets/server/utils/timesheet-validation'

defineRouteMeta({
  openAPI: {
    tags: ['Timesheets'],
    operationId: 'timesheetsWeeksByIdSubmissionsPost',
    summary: 'Create a timesheet submission batch',
    description: 'Submit eligible entries through a cutoff date as a new approval batch.'
  }
})

export default defineEventHandler(async (event) => {
  const { session, organizationId } = await requireFeatureAccess(event, timesheetsFeature.policy, 'submit')
  const input = submissionCreateSchema.parse(await readBody(event))
  return submitWeek(organizationId, session.user.id, getRouterParam(event, 'id')!, input.cutoffDate)
})
