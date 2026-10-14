import { z } from 'zod'
import { requireActiveOrganizationRole } from '@nuxt-customer-portal/core/server/portal'
import { actOnReviewRequest } from '@nuxt-customer-portal/timesheets/server/utils/client-review-requests'

export default defineEventHandler(async (event) => {
  const { organizationId, session, role } = await requireActiveOrganizationRole(event)
  const input = z
    .object({
      version: z.number().int().positive(),
      action: z.enum(['APPROVE', 'DISPUTE']),
      comment: z.string().trim().max(5000).optional()
    })
    .parse(await readBody(event))
  return actOnReviewRequest(
    organizationId,
    session.user.id,
    ['owner', 'admin'].includes(role) || session.user.role === 'admin',
    getRouterParam(event, 'id')!,
    input.version,
    input.action,
    input.comment
  )
})
