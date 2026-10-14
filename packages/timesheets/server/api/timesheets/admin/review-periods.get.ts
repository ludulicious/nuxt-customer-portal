import { z } from 'zod'
import { requireFeatureAccess, db } from '@nuxt-customer-portal/core/server/portal'
import { timesheetsFeature } from '@nuxt-customer-portal/timesheets/shared/feature'
import {
  listReviewPeriods,
  reviewToday,
  reviewCutover
} from '@nuxt-customer-portal/timesheets/server/utils/client-review-requests'

export default defineEventHandler(async (event) => {
  const { organizationId, organizationType } = await requireFeatureAccess(event, timesheetsFeature.policy, 'manage')
  if (organizationType !== 'PROVIDER') {
    throw createError({ statusCode: 403, message: 'Provider workspace required' })
  }
  const { month } = z
    .object({
      month: z
        .string()
        .regex(/^\d{4}-(0[1-9]|1[0-2])$/)
        .optional()
    })
    .parse(getQuery(event))
  return {
    startsOn: await reviewCutover(),
    periods: await listReviewPeriods(organizationId, month ?? (await reviewToday(db, organizationId)).slice(0, 7))
  }
})
