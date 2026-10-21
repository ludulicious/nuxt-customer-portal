import { downloadOrder } from '@nuxt-customer-portal/products/server/utils/downloads'
import { publicOrderDetails } from '@nuxt-customer-portal/products/server/utils/public-order'
import { publicLimit } from '@nuxt-customer-portal/products/server/utils/access'

export default defineEventHandler(async (event) => {
  setHeader(event, 'Cache-Control', 'private, no-store')
  setHeader(event, 'Referrer-Policy', 'no-referrer')
  setHeader(event, 'X-Robots-Tag', 'noindex, nofollow, noarchive')
  await publicLimit(event)
  const token = getRouterParam(event, 'token')!
  return publicOrderDetails(await downloadOrder(token), token)
})
