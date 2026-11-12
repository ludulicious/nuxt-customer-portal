import { requireFeatureAccess } from '@nuxt-customer-portal/core/server/portal'
import { timesheetsFeature } from '@nuxt-customer-portal/timesheets/shared/feature'
import {
  listReviewRequests,
  listSubmissionReviewRequests
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
  const [periods, submissions] = await Promise.all([
    listReviewRequests(organizationId, session.user.id, false, true),
    listSubmissionReviewRequests(organizationId)
  ])
  return [...periods, ...submissions]
})
