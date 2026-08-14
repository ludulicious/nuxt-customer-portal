import { requireServiceRequestScope } from '@nuxt-customer-portal/service-requests/server/utils/service-request-scope'
import { filterServiceRequestSchema } from '@nuxt-customer-portal/service-requests/server/utils/service-request-validation'
import { listServiceRequests } from '@nuxt-customer-portal/service-requests/server/utils/service-request-repository'

defineRouteMeta({
  openAPI: {
    tags: ['Service Requests'],
operationId: 'serviceRequestsGet',
    summary: 'List service requests',
    description: 'List service requests. Scoped to the active organization and the applicable Service Requests permission.'
  }
})

export default defineEventHandler(async (event) => {
  const scope = await requireServiceRequestScope(event, 'list')
  const filters = filterServiceRequestSchema.parse(getQuery(event))
  return listServiceRequests(scope.providerOrganizationId, filters, { clientOrganizationId: scope.clientOrganizationId, createdById: scope.ownOnly ? scope.session.user.id : undefined })
})
