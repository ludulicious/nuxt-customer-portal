import { admin } from '@nuxt-customer-portal/products/server/utils/access'
import { rows } from '@nuxt-customer-portal/products/server/utils/database'

export default defineEventHandler(async (event) => {
  const { organizationId } = await admin(event)
  const found = await rows(
    `UPDATE products.order_line l SET fulfilled=true FROM products.orders o WHERE l.order_id=o.id AND o.id=$1 AND o.store_id=$2 AND o.status='paid' AND NOT o.disputed AND o.refunded<o.total AND l.snapshot->'product'->>'type'='service' AND NOT l.fulfilled RETURNING l.id`,
    [getRouterParam(event, 'id'), organizationId]
  )
  if (!found.length) {
    throw createError({ statusCode: 409, message: 'Only paid service orders can be fulfilled' })
  }
  return { ok: true }
})
