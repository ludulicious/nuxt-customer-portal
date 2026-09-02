import { requireActiveOrganizationRole } from '@nuxt-customer-portal/core/server/portal'
import { reviewSubmission } from '@nuxt-customer-portal/timesheets/server/utils/timesheet-repository'
import { reviewSchema } from '@nuxt-customer-portal/timesheets/server/utils/timesheet-validation'

defineRouteMeta({
  openAPI: {
    tags: ['Timesheets'],
    operationId: 'timesheetsAdminApprovalsByIdPost',
    summary: 'Review a submitted timesheet',
    description:
      'Review a submitted timesheet. Scoped to the active organization and the applicable Timesheets permission.'
  }
})

export default defineEventHandler(async (event) => {
  const { session, organizationId } = await requireActiveOrganizationRole(event)
  const input = reviewSchema.parse(await readBody(event))
  return reviewSubmission(organizationId, session.user.id, getRouterParam(event, 'id')!, input.action, input.comment)
})
