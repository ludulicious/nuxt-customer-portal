import { z } from 'zod'
import { requireFeatureAccess } from '@nuxt-customer-portal/core/server/portal'
import { timesheetsFeature } from '@nuxt-customer-portal/timesheets/shared/feature'
import { sendReviewRequest } from '@nuxt-customer-portal/timesheets/server/utils/client-review-requests'

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
    .object({
      workspaceClientId: z.string().min(1),
      startsOn: z.iso.date(),
      endsOn: z.iso.date(),
      message: z.string().trim().max(5000).optional()
    })
    .parse(await readBody(event))
  return sendReviewRequest(
    organizationId,
    session.user.id,
    input.workspaceClientId,
    input.startsOn,
    input.endsOn,
    input.message
  )
})
