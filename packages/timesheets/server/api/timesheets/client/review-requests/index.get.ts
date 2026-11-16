import { reviewRequestQuerySchema } from '@nuxt-customer-portal/timesheets/server/utils/review-request-query'
import { requireActiveOrganizationRole } from '@nuxt-customer-portal/core/server/portal'
import {
  listReviewRequests,
  listReviewRequestSummaries
} from '@nuxt-customer-portal/timesheets/server/utils/client-review-requests'

export default defineEventHandler(async (event) => {
  const { organizationId, session, role } = await requireActiveOrganizationRole(event)
  const query = await getValidatedQuery(event, reviewRequestQuerySchema.parse)
  const list = query.summary === 'true' ? listReviewRequestSummaries : listReviewRequests
  return list(
    organizationId,
    session.user.id,
    true,
    ['owner', 'admin'].includes(role) || session.user.role === 'admin',
    { month: query.month }
  )
})
