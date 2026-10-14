import { z } from 'zod'
import { requireFeatureAccess } from '@nuxt-customer-portal/core/server/portal'
import { timesheetsFeature } from '@nuxt-customer-portal/timesheets/shared/feature'
import { actOnReviewRequest } from '@nuxt-customer-portal/timesheets/server/utils/client-review-requests'

export default defineEventHandler(async (event) => {
  const { organizationId, session, organizationType } = await requireFeatureAccess(
    event,
    timesheetsFeature.policy,
    'manage'
  )
  if (organizationType !== 'PROVIDER') {
    throw createError({ statusCode: 403, message: 'Provider workspace required' })
  }
  const input = z
    .object({ version: z.number().int().positive(), comment: z.string().trim().max(5000).optional() })
    .parse(await readBody(event))
  return actOnReviewRequest(
    organizationId,
    session.user.id,
    true,
    getRouterParam(event, 'id')!,
    input.version,
    'WITHDRAW',
    input.comment
  )
})
