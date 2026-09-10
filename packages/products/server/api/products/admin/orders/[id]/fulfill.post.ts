import { admin } from '@nuxt-customer-portal/products/server/utils/access'
import { rows } from '@nuxt-customer-portal/products/server/utils/database'

export default defineEventHandler(async (event) => {
  const { organizationId } = await admin(event)
  const found = await rows(
    `UPDATE products.purchase SET fulfilled=true WHERE id=$1 AND store_id=$2 AND status='paid' AND NOT disputed AND refunded<total AND snapshot->'product'->>'type'='service' RETURNING id`,
    [getRouterParam(event, 'id'), organizationId]
  )
  if (!found.length) {
    throw createError({ statusCode: 409, message: 'Only paid service orders can be fulfilled' })
  }
  return { ok: true }
})
