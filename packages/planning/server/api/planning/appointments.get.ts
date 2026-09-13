import { defineEventHandler } from 'h3'
import { claimPurchases } from '@nuxt-customer-portal/products/server/utils/orders'
import { rows } from '@nuxt-customer-portal/products/server/utils/database'

export default defineEventHandler(async (event) => {
  const userId = await claimPurchases(event)
  return rows(
    `SELECT a.id,a.start_at AS start,a.end_at AS end,a.status,a.snapshot->>'title' AS title,u.name AS "providerName",a.snapshot->>'customerTimezone' AS "customerTimezone" FROM planning.appointment a JOIN products.orders o ON o.id=a.order_id JOIN public."user" u ON u.id=a.user_id WHERE o.buyer_id=$1 ORDER BY a.start_at DESC LIMIT 100`,
    [userId]
  )
})
