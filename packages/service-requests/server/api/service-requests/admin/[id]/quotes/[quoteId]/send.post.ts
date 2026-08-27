import { sendServiceRequestQuote } from '@nuxt-customer-portal/service-requests/server/utils/service-request-repository'
import { requireServiceRequestScope } from '@nuxt-customer-portal/service-requests/server/utils/service-request-scope'

export default defineEventHandler(async (event) => {
  const scope = await requireServiceRequestScope(event, 'manage')
  return sendServiceRequestQuote(scope.providerOrganizationId, getRouterParam(event, 'id')!, getRouterParam(event, 'quoteId')!, scope.session.user.id)
})
