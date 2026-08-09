import { requireFeatureAccess } from '@nuxt-customer-portal/core/server/portal'
import { serviceRequestFeature } from '@nuxt-customer-portal/service-requests/shared/feature'
import { listServiceRequests } from '@nuxt-customer-portal/service-requests/server/utils/service-request-repository'
import { filterServiceRequestSchema } from '@nuxt-customer-portal/service-requests/server/utils/service-request-validation'

defineRouteMeta({
  openAPI: {
    tags: ['Service Requests'],
operationId: 'serviceRequestsAdminGet',
    summary: 'List service requests for administration',
    description: 'List service requests for administration. Scoped to the active organization and the applicable Service Requests permission.'
  }
})

export default defineEventHandler(async (event) => {
  const { organizationId } = await requireFeatureAccess(event, serviceRequestFeature.policy, 'manage')
  const filters = filterServiceRequestSchema.parse(getQuery(event))
  return listServiceRequests(organizationId, filters)
})
