import { defineEventHandler } from 'h3'
import { providerAccess } from '@nuxt-customer-portal/planning/server/utils/access'
import { rows } from '@nuxt-customer-portal/products/server/utils/database'

export default defineEventHandler(async (event) => {
  const { storeId, userId } = await providerAccess(event)
  return rows(
    `SELECT a.id,a.start_at AS start,a.end_at AS end,a.status,a.snapshot->>'title' AS title,a.conflict,a.effects_error AS "effectsError" FROM planning.appointment a WHERE a.store_id=$1 AND a.user_id=$2 AND a.end_at>now()-interval '7 days' ORDER BY start_at LIMIT 200`,
    [storeId, userId]
  )
})
