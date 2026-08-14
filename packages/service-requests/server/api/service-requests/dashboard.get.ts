import { getServiceRequestDashboard } from '@nuxt-customer-portal/service-requests/server/utils/service-request-repository'
import { requireServiceRequestScope } from '@nuxt-customer-portal/service-requests/server/utils/service-request-scope'

export default defineEventHandler(async (event) => {
  const scope = await requireServiceRequestScope(event, 'read')
  const canManage = scope.organizationType === 'PROVIDER' && (scope.role === 'owner' || scope.role === 'admin')
  return getServiceRequestDashboard(scope.providerOrganizationId, canManage, { clientOrganizationId: scope.clientOrganizationId, createdById: scope.ownOnly ? scope.session.user.id : undefined })
})
