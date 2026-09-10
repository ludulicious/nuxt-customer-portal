import { admin } from '@nuxt-customer-portal/products/server/utils/access'
import { rows } from '@nuxt-customer-portal/products/server/utils/database'

export default defineEventHandler(async (event) => {
  const { organizationId } = await admin(event)
  return rows(
    'SELECT id,name,prefix,expires_at,revoked_at,last_used_at,created_at FROM products.api_key WHERE store_id=$1 ORDER BY created_at DESC',
    [organizationId]
  )
})
