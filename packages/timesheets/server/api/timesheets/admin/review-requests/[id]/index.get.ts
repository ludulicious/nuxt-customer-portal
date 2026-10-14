import { requireFeatureAccess } from '@nuxt-customer-portal/core/server/portal'
import { timesheetsFeature } from '@nuxt-customer-portal/timesheets/shared/feature'
import { listReviewRequests } from '@nuxt-customer-portal/timesheets/server/utils/client-review-requests'

export default defineEventHandler(async (event) => {
  const { organizationId, session, organizationType } = await requireFeatureAccess(
    event,
    timesheetsFeature.policy,
    'manage'
  )
  if (organizationType !== 'PROVIDER') {
    throw createError({ statusCode: 403, message: 'Provider workspace required' })
  }
  const request = (await listReviewRequests(organizationId, session.user.id, false, true)).find(
    (request) => request.id === getRouterParam(event, 'id')
  )
  if (!request) {
    throw createError({ statusCode: 404, message: 'Review request not found' })
  }
  return request
})
