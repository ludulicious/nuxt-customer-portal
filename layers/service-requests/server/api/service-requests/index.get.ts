import { requireFeatureAccess } from '#portal/server/portal'
import { serviceRequestFeature } from '#layers/service-requests/shared/feature'
import { filterServiceRequestSchema } from '#layers/service-requests/server/utils/service-request-validation'
import { listServiceRequests } from '#layers/service-requests/server/utils/service-request-repository'

defineRouteMeta({
  openAPI: {
    tags: ['Service Requests'],
operationId: 'serviceRequestsGet',
    summary: 'List service requests',
    description: 'List service requests. Scoped to the active organization and the applicable Service Requests permission.'
  }
})

export default defineEventHandler(async (event) => {
  const { organizationId } = await requireFeatureAccess(event, serviceRequestFeature.policy, 'list')
  const filters = filterServiceRequestSchema.parse(getQuery(event))
  return listServiceRequests(organizationId, filters)
})
