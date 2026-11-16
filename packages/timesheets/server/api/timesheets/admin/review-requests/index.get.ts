import { reviewRequestQuerySchema } from '@nuxt-customer-portal/timesheets/server/utils/review-request-query'
import { requireFeatureAccess } from '@nuxt-customer-portal/core/server/portal'
import { timesheetsFeature } from '@nuxt-customer-portal/timesheets/shared/feature'
import {
  listReviewRequests,
  listSubmissionReviewRequests,
  listReviewRequestSummaries,
  listSubmissionReviewRequestSummaries
} from '@nuxt-customer-portal/timesheets/server/utils/client-review-requests'

export default defineEventHandler(async (event) => {
  const { organizationId, session, organizationType } = await requireFeatureAccess(
    event,
    timesheetsFeature.policy,
    'manage'
  )
  if (organizationType !== 'PROVIDER') {
    throw createError({ statusCode: 403, message: 'Provider workspace required' })
  }
  const query = await getValidatedQuery(event, reviewRequestQuerySchema.parse)
  const options = { month: query.month }
  const [periods, submissions] = await Promise.all([
    query.summary === 'true'
      ? listReviewRequestSummaries(organizationId, session.user.id, false, true, options)
      : listReviewRequests(organizationId, session.user.id, false, true, options),
    query.summary === 'true'
      ? listSubmissionReviewRequestSummaries(organizationId, options)
      : listSubmissionReviewRequests(organizationId, options)
  ])
  return [...periods, ...submissions]
})
