import { requireServiceRequestScope } from '@nuxt-customer-portal/service-requests/server/utils/service-request-scope'
import { previewServiceRequestQuoteEmail } from '@nuxt-customer-portal/service-requests/server/utils/service-request-quote-email'

export default defineEventHandler(async (event) => {
  await requireServiceRequestScope(event, 'manage')
  const result = await previewServiceRequestQuoteEmail(
    getRouterParam(event, 'id')!,
    getRouterParam(event, 'quoteId')!,
    String(getQuery(event).locale || 'en')
  )
  const { request: _request, quote: _quote, values: _values, ...preview } = result
  return preview
})
