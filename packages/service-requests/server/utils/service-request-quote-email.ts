import { renderPortalEmail, sendPortalEmail } from '@nuxt-customer-portal/core/server/utils/portal-email'
import { serviceRequestFeature } from '@nuxt-customer-portal/service-requests/shared/feature'
import { generateServiceRequestQuotePdf } from './service-request-quote-pdf'
import { getServiceRequestDetail } from './service-request-repository'

const definition = serviceRequestFeature.emails![0]!
export const previewServiceRequestQuoteEmail = async (requestId: string, quoteId: string, locale = 'en') => {
  const request = await getServiceRequestDetail(requestId)
  const quote = request?.quotes?.find((item) => item.id === quoteId)
  if (!request || !quote) {
throw createError({ statusCode: 404, message: 'Quote not found' })
}
  const selectedLocale = locale === 'nl' ? 'nl' : 'en'
  const values = { quote_number: quote.number, request_title: request.title, valid_until: quote.validUntil }
  const rendered = await renderPortalEmail({ moduleId: serviceRequestFeature.id, definition, locale: selectedLocale, values })
  return { to: request.contactEmail || '', locale: selectedLocale, subject: rendered.subject, body: rendered.body, values, request, quote }
}
export const deliverServiceRequestQuoteEmail = async (requestId: string, quoteId: string, input: { to: string; locale: 'en' | 'nl'; subject: string; body: string }) => {
  const preview = await previewServiceRequestQuoteEmail(requestId, quoteId, input.locale)
  const pdf = await generateServiceRequestQuotePdf(preview.request, preview.quote, input.locale)
  return sendPortalEmail({ moduleId: serviceRequestFeature.id, definition, locale: input.locale, values: preview.values, to: input.to, text: { subject: input.subject, body: input.body }, attachments: [{ filename: `quote-${preview.quote.number}.pdf`, content: Buffer.from(pdf), contentType: 'application/pdf' }], idempotencyKey: `service-request-quote-${quoteId}-${input.to}` })
}
