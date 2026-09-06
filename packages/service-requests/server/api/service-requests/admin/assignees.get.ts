import { requireServiceRequestScope } from '@nuxt-customer-portal/service-requests/server/utils/service-request-scope'
import { listServiceRequestAssignees } from '@nuxt-customer-portal/service-requests/server/utils/service-request-repository'

export default defineEventHandler(async (event) => {
  const scope = await requireServiceRequestScope(event, 'manage')
  return listServiceRequestAssignees(scope.providerOrganizationId)
})
