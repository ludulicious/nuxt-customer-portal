import { listServiceRequestAssignees } from '@nuxt-customer-portal/service-requests/server/utils/service-request-repository'
import { requireServiceRequestScope } from '@nuxt-customer-portal/service-requests/server/utils/service-request-scope'

export default defineEventHandler(async (event) => {
  const scope = await requireServiceRequestScope(event, 'manage')
  const current = getQuery(event).current
  return listServiceRequestAssignees(scope.providerOrganizationId, typeof current === 'string' ? current : undefined)
})
