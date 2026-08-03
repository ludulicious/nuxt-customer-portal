import { hasFeatureAccess, requireFeatureAccess } from '#portal/server/portal'
import { serviceRequestFeature } from '#layers/service-requests/shared/feature'
import { findServiceRequest, toServiceRequestDto } from '#layers/service-requests/server/utils/service-request-repository'

defineRouteMeta({
  openAPI: {
    tags: ['Service Requests'],
operationId: 'serviceRequestsByIdGet',
    summary: 'Get a service request',
    description: 'Get a service request. Scoped to the active organization and the applicable Service Requests permission.'
  }
})

export default defineEventHandler(async (event) => {
  const { session, organizationId } = await requireFeatureAccess(event, serviceRequestFeature.policy, 'read')
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: 'Request id is required' })

  const row = await findServiceRequest(id)
  if (!row || row.organizationId !== organizationId) {
    throw createError({ statusCode: 404, message: 'Request not found' })
  }

  const dto = toServiceRequestDto(row)
  if (!await hasFeatureAccess(session, organizationId, serviceRequestFeature.policy, 'manage')) {
    dto.internalNotes = null
  }
  return dto
})
