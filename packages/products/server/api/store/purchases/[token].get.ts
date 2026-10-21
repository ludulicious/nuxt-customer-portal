import { purchaseLinks } from '../../../../shared/links'
import { downloadOrder, purchaseDownloads } from '@nuxt-customer-portal/products/server/utils/downloads'
import { purchaseThankYouVariant } from '../../../../shared/thank-you'
import { publicLimit } from '@nuxt-customer-portal/products/server/utils/access'

export default defineEventHandler(async (event) => {
  setHeader(event, 'Cache-Control', 'private, no-store')
  setHeader(event, 'Referrer-Policy', 'no-referrer')
  await publicLimit(event)
  const token = getRouterParam(event, 'token')!
  const order = await downloadOrder(token)
  const origin = getHeader(event, 'origin')
  if (origin && order.snapshot.returnUrl && origin === new URL(order.snapshot.returnUrl).origin) {
    setHeader(event, 'Access-Control-Allow-Origin', origin)
    setHeader(event, 'Vary', 'Origin')
  }
  return {
    status: order.status,
    variant: purchaseThankYouVariant(order),
    files: await purchaseDownloads(order, token),
    links: purchaseLinks(order)
  }
})
