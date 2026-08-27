import { findServiceRequest, getServiceRequestAttachment } from '@nuxt-customer-portal/service-requests/server/utils/service-request-repository'
import { canAccessScopedRequest, requireServiceRequestScope } from '@nuxt-customer-portal/service-requests/server/utils/service-request-scope'

export default defineEventHandler(async (event) => {
  const scope = await requireServiceRequestScope(event, 'read')
  const id = getRouterParam(event, 'id')!
  const request = await findServiceRequest(id)
  if (!request || !canAccessScopedRequest(request, scope)) {
throw createError({ statusCode: 404, message: 'Request not found' })
}
  const file = await getServiceRequestAttachment(id, getRouterParam(event, 'attachmentId')!)
  if (!file) {
throw createError({ statusCode: 404, message: 'Attachment not found' })
}
  setResponseHeaders(event, { 'content-type': file.contentType, 'content-length': file.size, 'content-disposition': `attachment; filename*=UTF-8''${encodeURIComponent(file.fileName)}` })
  return Buffer.from(file.contentBase64, 'base64')
})
