import { findServiceRequest, removeServiceRequestAttachment } from '@nuxt-customer-portal/service-requests/server/utils/service-request-repository'
import { canAccessScopedRequest, requireServiceRequestScope } from '@nuxt-customer-portal/service-requests/server/utils/service-request-scope'

export default defineEventHandler(async (event) => {
  const scope = await requireServiceRequestScope(event, 'update')
  const id = getRouterParam(event, 'id')!
  const request = await findServiceRequest(id)
  if (!request || !canAccessScopedRequest(request, scope)) {
throw createError({ statusCode: 404, message: 'Request not found' })
}
  await removeServiceRequestAttachment(id, getRouterParam(event, 'attachmentId')!, scope.session.user.id)
  return { success: true }
})
