import { authorize, hasFeatureAccess, requireFeatureAccess } from '#portal/server/portal'
import { serviceRequestFeature } from '#layers/service-requests/shared/feature'
import { deleteServiceRequest, findServiceRequest } from '#layers/service-requests/server/utils/service-request-repository'

defineRouteMeta({
  openAPI: {
    tags: ['Service Requests'],
operationId: 'serviceRequestsByIdDelete',
    summary: 'Delete a service request',
    description: 'Delete a service request. Scoped to the active organization and the applicable Service Requests permission.'
  }
})

export default defineEventHandler(async (event) => {
  const { session, organizationId } = await requireFeatureAccess(event, serviceRequestFeature.policy, 'read')
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: 'Request id is required' })
  const existing = await findServiceRequest(id)
  if (!existing || existing.organizationId !== organizationId) {
    throw createError({ statusCode: 404, message: 'Request not found' })
  }

  const isOwner = existing.createdById === session.user.id
  if (!isOwner && !await hasFeatureAccess(session, organizationId, serviceRequestFeature.policy, 'delete')) {
    await authorize(session, organizationId, serviceRequestFeature.policy, 'delete')
  }
  await deleteServiceRequest(id)
  return { success: true }
})
