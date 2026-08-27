import { getServiceRequestDetail } from '@nuxt-customer-portal/service-requests/server/utils/service-request-repository'
import { generateServiceRequestQuotePdf } from '@nuxt-customer-portal/service-requests/server/utils/service-request-quote-pdf'
import { canAccessScopedRequest, requireServiceRequestScope } from '@nuxt-customer-portal/service-requests/server/utils/service-request-scope'

export default defineEventHandler(async (event) => {
  const scope = await requireServiceRequestScope(event, 'read')
  const request = await getServiceRequestDetail(getRouterParam(event, 'id')!)
  if (!request || !canAccessScopedRequest(request, scope)) {
throw createError({ statusCode: 404, message: 'Request not found' })
}
  const quote = request.quotes?.find((item) => item.id === getRouterParam(event, 'quoteId'))
  if (!quote) {
throw createError({ statusCode: 404, message: 'Quote not found' })
}
  const pdf = await generateServiceRequestQuotePdf(request, quote, String(getQuery(event).locale || 'en'))
  setResponseHeaders(event, { 'content-type': 'application/pdf', 'content-disposition': `inline; filename="quote-${quote.number.replace(/[^a-z0-9.-]/gi, '-')}.pdf"` })
  return Buffer.from(pdf)
})
