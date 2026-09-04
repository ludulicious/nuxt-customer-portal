import { z } from 'zod'
import { requireActiveOrganizationRole } from '@nuxt-customer-portal/core/server/portal'
import { internalApprovalListQuerySchema } from '@nuxt-customer-portal/timesheets/server/utils/timesheet-validation'
import { listProviderClientApprovalsPage } from '@nuxt-customer-portal/timesheets/server/utils/timesheet-admin-listing'

export default defineEventHandler(async (event) => {
  const { session, organizationId, role } = await requireActiveOrganizationRole(event)
  if (!['owner', 'admin'].includes(role)) {
    throw createError({ statusCode: 403, message: 'Workspace administrator access required' })
  }
  const query = internalApprovalListQuerySchema
    .extend({
      clientOrganizationId: z.string().min(1).optional(),
      status: z.enum(['PENDING', 'APPROVED', 'DISPUTED', 'AUTO_APPROVED']).optional()
    })
    .parse(getQuery(event))
  return listProviderClientApprovalsPage(organizationId, session.user.id, query)
})
