import { admin } from '@nuxt-customer-portal/products/server/utils/access'
import { rows } from '@nuxt-customer-portal/products/server/utils/database'

export default defineEventHandler(async (event) => {
  const { organizationId } = await admin(event)
  await rows('UPDATE products.api_key SET revoked_at=now() WHERE id=$1 AND store_id=$2', [
    getRouterParam(event, 'id'),
    organizationId
  ])
  return { ok: true }
})
