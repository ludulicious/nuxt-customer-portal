import { requireFeatureAccess } from '@nuxt-customer-portal/core/server/portal'
import { serviceRequestFeature } from '@nuxt-customer-portal/service-requests/shared/feature'
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
  const { organizationId } = await requireFeatureAccess(event, serviceRequestFeature.policy, 'list')
  const filters = filterServiceRequestSchema.parse(getQuery(event))
  return listServiceRequests(organizationId, filters)
})
