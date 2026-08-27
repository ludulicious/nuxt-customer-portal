import { addServiceRequestComment, findServiceRequest } from '@nuxt-customer-portal/service-requests/server/utils/service-request-repository'
import { canAccessScopedRequest, requireServiceRequestScope } from '@nuxt-customer-portal/service-requests/server/utils/service-request-scope'
import { serviceRequestCommentSchema } from '@nuxt-customer-portal/service-requests/server/utils/service-request-validation'

export default defineEventHandler(async (event) => {
  const scope = await requireServiceRequestScope(event, 'update')
  const id = getRouterParam(event, 'id')!
  const request = await findServiceRequest(id)
  if (!request || !canAccessScopedRequest(request, scope)) {
throw createError({ statusCode: 404, message: 'Request not found' })
}
  return addServiceRequestComment(id, scope.session.user.id, serviceRequestCommentSchema.parse(await readBody(event)).body)
})
