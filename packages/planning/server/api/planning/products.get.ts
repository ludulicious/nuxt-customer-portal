import { defineEventHandler } from 'h3'
import { appointmentScope } from '@nuxt-customer-portal/planning/server/utils/access'
import { rows } from '@nuxt-customer-portal/products/server/utils/database'

export default defineEventHandler(async (event) => {
  const scope = await appointmentScope(event)
  return rows(
    `SELECT slug,COALESCE(NULLIF(data->'content'->'en'->>'title',''),data->'content'->'nl'->>'title') AS title FROM products.product WHERE store_id=$1 AND data->>'status'='published' AND data->>'type'='service' AND data->'planning'->>'enabled'='true' ORDER BY title,id`,
    [scope.storeId]
  )
})
