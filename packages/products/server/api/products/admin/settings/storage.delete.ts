import { admin } from '@nuxt-customer-portal/products/server/utils/access'
import { rows } from '@nuxt-customer-portal/products/server/utils/database'
import { environmentStorageConfigured } from '@nuxt-customer-portal/products/server/utils/storage-configuration'

export default defineEventHandler(async (event) => {
  const context = await admin(event)
  if (environmentStorageConfigured()) {
    throw createError({ statusCode: 409, message: 'Storage is managed by the deployment' })
  }
  await rows(
    `UPDATE products.store SET storage_provider='s3',storage_endpoint=NULL,storage_region=NULL,storage_bucket=NULL,storage_access_key_id=NULL,
    storage_secret_access_key=NULL,storage_path_style=false,storage_tested_at=NULL,actor_id=$2 WHERE id=true AND organization_id=$1`,
    [context.organizationId, context.session.user.id]
  )
  return { configured: false }
})
