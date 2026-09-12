import { publicLimit, baseUrl } from '@nuxt-customer-portal/products/server/utils/access'
import { createCheckout } from '@nuxt-customer-portal/products/server/utils/orders'

export default defineEventHandler(async (event) => {
  await publicLimit(event)
  if (getHeader(event, 'origin') !== baseUrl()) {
    throw createError({ statusCode: 403, message: 'Checkout must originate from the portal' })
  }
  return createCheckout(event, await readBody(event))
})
