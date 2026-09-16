import { defineEventHandler } from 'h3'
import { providerAccess } from '@nuxt-customer-portal/planning/server/utils/access'
import { rows } from '@nuxt-customer-portal/products/server/utils/database'

export default defineEventHandler(async (event) => {
  const { storeId, userId } = await providerAccess(event)
  return rows(
    `SELECT a.id,a.start_at AS start,a.end_at AS end,a.status,a.snapshot->>'title' AS title,a.conflict,a.effects_error AS "effectsError",o.email,o.snapshot->'billing'->>'name' AS "customerName",o.snapshot->'billing'->>'country' AS country FROM planning.appointment a JOIN products.orders o ON o.id=a.order_id WHERE a.store_id=$1 AND a.user_id=$2 AND a.end_at>now()-interval '7 days' ORDER BY start_at LIMIT 200`,
    [storeId, userId]
  )
})
