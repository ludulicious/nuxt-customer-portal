import { getStore, publicLimit } from '@nuxt-customer-portal/products/server/utils/access'
import { getOrder } from '@nuxt-customer-portal/products/server/utils/orders'

export default defineEventHandler(async (event) => {
  await publicLimit(event)
  const store = await getStore(true)
  const order = await getOrder(getRouterParam(event, 'id')!)
  if (
    store.mode !== 'sandbox' ||
    !order ||
    order.store_id !== store.organization_id ||
    order.checkout_id !== `sandbox:${order.id}`
  ) {
    throw createError({ statusCode: 404 })
  }
  const line = order.lines[0]!
  setHeader(event, 'Cache-Control', 'no-store')
  return {
    id: order.id,
    status: order.status,
    title: line.snapshot.title,
    amount: line.unit_amount,
    currency: line.snapshot.price.currency,
    email: order.email
  }
})
