import { requireFeatureAccess } from '@nuxt-customer-portal/core/server/portal'
import { serviceRequestFeature } from '@nuxt-customer-portal/service-requests/shared/feature'
import { findServiceRequest, toServiceRequestDto, updateServiceRequest } from '@nuxt-customer-portal/service-requests/server/utils/service-request-repository'
import { updateServiceRequestSchema } from '@nuxt-customer-portal/service-requests/server/utils/service-request-validation'

defineRouteMeta({
  openAPI: {
    tags: ['Service Requests'],
operationId: 'serviceRequestsByIdPatch',
    summary: 'Update a service request',
    description: 'Update a service request. Scoped to the active organization and the applicable Service Requests permission.'
  }
})

export default defineEventHandler(async (event) => {
  const { organizationId } = await requireFeatureAccess(event, serviceRequestFeature.policy, 'update')
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: 'Request id is required' })
  const existing = await findServiceRequest(id)
  if (!existing || existing.organizationId !== organizationId) {
    throw createError({ statusCode: 404, message: 'Request not found' })
  }

  const data = updateServiceRequestSchema.parse(await readBody(event))
  const row = await updateServiceRequest(id, {
    title: data.title,
    description: data.description,
    priority: data.priority,
    category: data.category
  })
  if (!row) throw createError({ statusCode: 404, message: 'Request not found' })
  return toServiceRequestDto(row)
})
