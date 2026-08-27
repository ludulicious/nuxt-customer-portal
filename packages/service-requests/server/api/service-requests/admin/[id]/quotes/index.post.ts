import { createServiceRequestQuote } from '@nuxt-customer-portal/service-requests/server/utils/service-request-repository'
import { requireServiceRequestScope } from '@nuxt-customer-portal/service-requests/server/utils/service-request-scope'
import { serviceRequestQuoteCreateSchema } from '@nuxt-customer-portal/service-requests/server/utils/service-request-validation'

export default defineEventHandler(async (event) => {
  const scope = await requireServiceRequestScope(event, 'manage')
  return createServiceRequestQuote(scope.providerOrganizationId, getRouterParam(event, 'id')!, scope.session.user.id, serviceRequestQuoteCreateSchema.parse(await readBody(event)))
})
