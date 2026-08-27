import { decideServiceRequestQuote, findServiceRequest } from '@nuxt-customer-portal/service-requests/server/utils/service-request-repository'
import { canAccessScopedRequest, requireServiceRequestScope } from '@nuxt-customer-portal/service-requests/server/utils/service-request-scope'
import { serviceRequestQuoteDecisionSchema } from '@nuxt-customer-portal/service-requests/server/utils/service-request-validation'

export default defineEventHandler(async (event) => {
  const scope = await requireServiceRequestScope(event, 'update')
  const id = getRouterParam(event, 'id')!
  const request = await findServiceRequest(id)
  if (!request || !canAccessScopedRequest(request, scope)) {
throw createError({ statusCode: 404, message: 'Request not found' })
}
  const { action } = serviceRequestQuoteDecisionSchema.parse(await readBody(event))
  await decideServiceRequestQuote(scope.providerOrganizationId, id, getRouterParam(event, 'quoteId')!, scope.session.user.id, action)
  return { success: true }
})
