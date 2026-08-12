import { hasFeatureAccess } from '@nuxt-customer-portal/core/server/portal'
import { serviceRequestFeature } from '@nuxt-customer-portal/service-requests/shared/feature'
import { findServiceRequest, toServiceRequestDto } from '@nuxt-customer-portal/service-requests/server/utils/service-request-repository'
import { canAccessScopedRequest, requireServiceRequestScope } from '@nuxt-customer-portal/service-requests/server/utils/service-request-scope'

defineRouteMeta({
  openAPI: {
    tags: ['Service Requests'],
operationId: 'serviceRequestsByIdGet',
    summary: 'Get a service request',
    description: 'Get a service request. Scoped to the active organization and the applicable Service Requests permission.'
  }
})

export default defineEventHandler(async (event) => {
  const scope = await requireServiceRequestScope(event, 'read')
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: 'Request id is required' })

  const row = await findServiceRequest(id)
  if (!row || !canAccessScopedRequest(row, scope)) {
    throw createError({ statusCode: 404, message: 'Request not found' })
  }

  const dto = toServiceRequestDto(row)
  if (!await hasFeatureAccess(scope.session, scope.organizationId, serviceRequestFeature.policy, 'manage')) {
    dto.internalNotes = null
  }
  return dto
})
