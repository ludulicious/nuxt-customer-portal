import { requireFeatureAccess } from '#portal/server/portal'
import { serviceRequestFeature } from '#layers/service-requests/shared/feature'
import { findServiceRequest, toServiceRequestDto, updateServiceRequest } from '#layers/service-requests/server/utils/service-request-repository'
import { adminUpdateServiceRequestSchema } from '#layers/service-requests/server/utils/service-request-validation'

defineRouteMeta({
  openAPI: {
    tags: ['Service Requests'],
operationId: 'serviceRequestsAdminByIdPatch',
    summary: 'Update a service request as an administrator',
    description: 'Update a service request as an administrator. Scoped to the active organization and the applicable Service Requests permission.'
  }
})

export default defineEventHandler(async (event) => {
  const { organizationId } = await requireFeatureAccess(event, serviceRequestFeature.policy, 'manage')
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: 'Request id is required' })
  const existing = await findServiceRequest(id)
  if (!existing || existing.organizationId !== organizationId) {
    throw createError({ statusCode: 404, message: 'Request not found' })
  }

  const data = adminUpdateServiceRequestSchema.parse(await readBody(event))
  const row = await updateServiceRequest(id, {
    ...data,
    resolvedAt: data.status === 'RESOLVED' ? new Date() : existing.resolvedAt,
    closedAt: data.status === 'CLOSED' ? new Date() : existing.closedAt
  })
  if (!row) throw createError({ statusCode: 404, message: 'Request not found' })
  return toServiceRequestDto(row)
})
