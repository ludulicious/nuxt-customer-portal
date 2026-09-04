import { z } from 'zod'
import { requireActiveOrganizationRole } from '@nuxt-customer-portal/core/server/portal'
import { requestClientApproval } from '@nuxt-customer-portal/timesheets/server/utils/timesheet-repository'

export default defineEventHandler(async (event) => {
  const { organizationId, role, session } = await requireActiveOrganizationRole(event)
  if (!['owner', 'admin'].includes(role)) {
    throw createError({ statusCode: 403, message: 'Workspace administrator access required' })
  }
  const input = z
    .object({ clientOrganizationId: z.string().min(1), message: z.string().trim().max(5000).optional() })
    .parse(await readBody(event))
  await requestClientApproval(
    organizationId,
    getRouterParam(event, 'id')!,
    input.clientOrganizationId,
    session.user.id,
    input.message
  )
  return { success: true }
})
