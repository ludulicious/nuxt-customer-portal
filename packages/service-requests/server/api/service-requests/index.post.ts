import { nanoid } from 'nanoid'
import { requireClientModuleEnabled } from '@nuxt-customer-portal/clients/server/utils/client-repository'
import { requireServiceRequestScope } from '@nuxt-customer-portal/service-requests/server/utils/service-request-scope'
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
  const scope = await requireServiceRequestScope(event, 'create')
  const data = createServiceRequestSchema.parse(await readBody(event))
  const clientOrganizationId = scope.clientOrganizationId ?? data.clientOrganizationId
  if (!clientOrganizationId) throw createError({ statusCode: 400, message: 'Client is required' })
  await requireClientModuleEnabled(clientOrganizationId, 'service-requests')
  const row = await createServiceRequest({
    id: nanoid(),
    ...data,
    organizationId: scope.ownerOrganizationId,
    clientOrganizationId,
    createdById: scope.session.user.id
  })
  if (!row) throw createError({ statusCode: 500, message: 'Failed to create request' })
  return toServiceRequestDto(row)
})
