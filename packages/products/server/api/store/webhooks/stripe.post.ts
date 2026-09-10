import { stripeProvider } from '@nuxt-customer-portal/products/server/utils/payments'
import { handleWebhook } from '@nuxt-customer-portal/products/server/utils/webhooks'

export default defineEventHandler(async (event) => {
  const body = await readRawBody(event)
  if (!body) {
    throw createError({ statusCode: 400 })
  }
  let verified
  try {
    verified = stripeProvider.verify(body, getHeader(event, 'stripe-signature') || '')
  } catch {
    throw createError({ statusCode: 400, message: 'Invalid webhook signature' })
  }
  await handleWebhook(verified)
  return { received: true }
})
