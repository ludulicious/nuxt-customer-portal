import { z } from 'zod'
import { requireServiceRequestScope } from '@nuxt-customer-portal/service-requests/server/utils/service-request-scope'
import { deliverServiceRequestQuoteEmail } from '@nuxt-customer-portal/service-requests/server/utils/service-request-quote-email'

const schema = z.object({ to: z.email(), locale: z.enum(['en', 'nl']), subject: z.string().trim().min(1).max(500), body: z.string().trim().min(1).max(10000) })
export default defineEventHandler(async (event) => {
  await requireServiceRequestScope(event, 'manage')
  const result = await deliverServiceRequestQuoteEmail(
    getRouterParam(event, 'id')!,
    getRouterParam(event, 'quoteId')!,
    schema.parse(await readBody(event))
  )
  return { id: result.id }
})
