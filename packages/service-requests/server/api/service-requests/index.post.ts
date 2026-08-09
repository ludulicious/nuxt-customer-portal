import { nanoid } from 'nanoid'
import { requireFeatureAccess } from '@nuxt-customer-portal/core/server/portal'
import { serviceRequestFeature } from '@nuxt-customer-portal/service-requests/shared/feature'
import { createServiceRequestSchema } from '@nuxt-customer-portal/service-requests/server/utils/service-request-validation'
import { createServiceRequest, toServiceRequestDto } from '@nuxt-customer-portal/service-requests/server/utils/service-request-repository'

defineRouteMeta({
  openAPI: {
    tags: ['Service Requests'],
operationId: 'serviceRequestsPost',
    summary: 'Create a service request',
    description: 'Create a service request. Scoped to the active organization and the applicable Service Requests permission.'
  }
})

export default defineEventHandler(async (event) => {
  const { session, organizationId } = await requireFeatureAccess(event, serviceRequestFeature.policy, 'create')
  const data = createServiceRequestSchema.parse(await readBody(event))
  const row = await createServiceRequest({
    id: nanoid(),
    ...data,
    organizationId,
    createdById: session.user.id
  })
  if (!row) throw createError({ statusCode: 500, message: 'Failed to create request' })
  return toServiceRequestDto(row)
})
