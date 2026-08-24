import { authorize, hasFeatureAccess } from '@nuxt-customer-portal/core/server/portal'
import { serviceRequestFeature } from '@nuxt-customer-portal/service-requests/shared/feature'
import {
  deleteServiceRequest,
  findServiceRequest
} from '@nuxt-customer-portal/service-requests/server/utils/service-request-repository'
import {
  canAccessScopedRequest,
  requireServiceRequestScope
} from '@nuxt-customer-portal/service-requests/server/utils/service-request-scope'

defineRouteMeta({
  openAPI: {
    tags: ['Service Requests'],
    operationId: 'serviceRequestsByIdDelete',
    summary: 'Delete a service request',
    description:
      'Delete a service request. Scoped to the active organization and the applicable Service Requests permission.'
  }
})

export default defineEventHandler(async (event) => {
  const scope = await requireServiceRequestScope(event, 'read')
  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, message: 'Request id is required' })
  }
  const existing = await findServiceRequest(id)
  if (!existing || !canAccessScopedRequest(existing, scope)) {
    throw createError({ statusCode: 404, message: 'Request not found' })
  }

  const isOwner = existing.createdById === scope.session.user.id
  if (
    !isOwner &&
    !(await hasFeatureAccess(scope.session, scope.organizationId, serviceRequestFeature.policy, 'delete'))
  ) {
    await authorize(scope.session, scope.organizationId, serviceRequestFeature.policy, 'delete')
  }
  await deleteServiceRequest(id)
  return { success: true }
})
