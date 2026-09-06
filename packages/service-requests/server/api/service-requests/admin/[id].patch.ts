import {
  findServiceRequest,
  listServiceRequestAssignees,
  toServiceRequestDto,
  updateServiceRequest
} from '@nuxt-customer-portal/service-requests/server/utils/service-request-repository'
import { adminUpdateServiceRequestSchema } from '@nuxt-customer-portal/service-requests/server/utils/service-request-validation'
import {
  canAccessScopedRequest,
  requireServiceRequestScope
} from '@nuxt-customer-portal/service-requests/server/utils/service-request-scope'

defineRouteMeta({
  openAPI: {
    tags: ['Service Requests'],
    operationId: 'serviceRequestsAdminByIdPatch',
    summary: 'Update a service request as an administrator',
    description:
      'Update a service request as an administrator. Scoped to the active organization and the applicable Service Requests permission.'
  }
})

export default defineEventHandler(async (event) => {
  const scope = await requireServiceRequestScope(event, 'manage')
  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, message: 'Request id is required' })
  }
  const existing = await findServiceRequest(id)
  if (!existing || !canAccessScopedRequest(existing, scope)) {
    throw createError({ statusCode: 404, message: 'Request not found' })
  }

  const data = adminUpdateServiceRequestSchema.parse(await readBody(event))
  if (data.assignedToId && data.assignedToId !== existing.assignedToId) {
    const assignees = await listServiceRequestAssignees(scope.providerOrganizationId)
    if (!assignees.some((user) => user.id === data.assignedToId)) {
      throw createError({ statusCode: 400, message: 'Assignee must belong to the provider organization' })
    }
  }
  const row = await updateServiceRequest(id, {
    ...data,
    ...(data.assignedToId !== undefined ? { assignedToId: data.assignedToId || null } : {}),
    resolvedAt: data.status === 'RESOLVED' ? new Date() : existing.resolvedAt,
    closedAt: data.status === 'CLOSED' ? new Date() : existing.closedAt
  })
  if (!row) {
    throw createError({ statusCode: 404, message: 'Request not found' })
  }
  return toServiceRequestDto(row)
})
