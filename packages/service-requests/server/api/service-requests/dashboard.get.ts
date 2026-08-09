import { requireActiveOrganizationRole } from '@nuxt-customer-portal/core/server/portal'
import { getServiceRequestDashboard } from '@nuxt-customer-portal/service-requests/server/utils/service-request-repository'

export default defineEventHandler(async (event) => {
  const { session, organizationId, role } = await requireActiveOrganizationRole(event)
  const canManage = role === 'owner' || role === 'admin' || session.user.role === 'admin'
  return getServiceRequestDashboard(organizationId, canManage)
})
