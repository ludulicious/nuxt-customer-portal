import { downloadOrder, sendPurchasedAsset } from '@nuxt-customer-portal/products/server/utils/downloads'
import { publicLimit } from '@nuxt-customer-portal/products/server/utils/access'

export default defineEventHandler(async (event) => {
  setHeader(event, 'Cache-Control', 'private, no-store')
  setHeader(event, 'Referrer-Policy', 'no-referrer')
  await publicLimit(event)
  const order = await downloadOrder(getRouterParam(event, 'token')!)
  return sendPurchasedAsset(event, order, getRouterParam(event, 'assetId')!, 'public')
})
