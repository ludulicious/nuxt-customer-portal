import { requireActiveOrganizationRole } from '@nuxt-customer-portal/core/server/portal'
import { listReviewRequests } from '@nuxt-customer-portal/timesheets/server/utils/client-review-requests'

export default defineEventHandler(async (event) => {
  const { organizationId, session, role } = await requireActiveOrganizationRole(event)
  return listReviewRequests(
    organizationId,
    session.user.id,
    true,
    ['owner', 'admin'].includes(role) || session.user.role === 'admin'
  )
})
