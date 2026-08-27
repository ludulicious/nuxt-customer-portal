import { addServiceRequestAttachment, findServiceRequest } from '@nuxt-customer-portal/service-requests/server/utils/service-request-repository'
import { canAccessScopedRequest, requireServiceRequestScope } from '@nuxt-customer-portal/service-requests/server/utils/service-request-scope'

const allowed = new Set(['application/pdf', 'image/jpeg', 'image/png', 'text/plain'])
export default defineEventHandler(async (event) => {
  const scope = await requireServiceRequestScope(event, 'update')
  const id = getRouterParam(event, 'id')!
  const request = await findServiceRequest(id)
  if (!request || !canAccessScopedRequest(request, scope)) {
throw createError({ statusCode: 404, message: 'Request not found' })
}
  const part = (await readMultipartFormData(event))?.find((item) => item.name === 'file' && item.filename)
  if (!part?.filename || !part.type || !allowed.has(part.type) || part.data.length > 10 * 1024 * 1024) {
throw createError({ statusCode: 400, message: 'Upload a PDF, PNG, JPEG, or text file up to 10 MB' })
}
  return addServiceRequestAttachment(id, scope.session.user.id, { fileName: part.filename, contentType: part.type, size: part.data.length, contentBase64: part.data.toString('base64') })
})
