import { defineEventHandler } from 'h3'
import { planningAdmin } from '@nuxt-customer-portal/planning/server/utils/access'
import { rows } from '@nuxt-customer-portal/products/server/utils/database'

export default defineEventHandler(async (event) => {
  const context = await planningAdmin(event)
  return rows(
    `SELECT a.id,a.start_at AS start,a.end_at AS end,a.status,a.snapshot->>'title' AS title,a.conflict,a.effects_error AS "effectsError",u.name AS "providerName",o.email FROM planning.appointment a JOIN public."user" u ON u.id=a.user_id JOIN products.orders o ON o.id=a.order_id WHERE a.store_id=$1 ORDER BY start_at DESC LIMIT 200`,
    [context.organizationId]
  )
})
