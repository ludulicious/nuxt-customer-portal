import { admin } from '@nuxt-customer-portal/products/server/utils/access'
import { rows } from '@nuxt-customer-portal/products/server/utils/database'
import { parseInput } from '@nuxt-customer-portal/products/server/utils/validation'
import { storageSettingsSchema } from '@nuxt-customer-portal/products/shared/validation'
import {
  decryptStorageSecret,
  encryptStorageSecret,
  environmentStorageConfigured,
  testStorageConfiguration,
  type StorageConfiguration
} from '@nuxt-customer-portal/products/server/utils/storage-configuration'

export default defineEventHandler(async (event) => {
  const context = await admin(event)
  if (environmentStorageConfigured()) {
    throw createError({ statusCode: 409, message: 'Storage is managed by the deployment' })
  }
  const input = parseInput(storageSettingsSchema, await readBody(event))
  if (process.env.NODE_ENV === 'production' && input.endpoint && !input.endpoint.startsWith('https://')) {
    throw createError({ statusCode: 422, message: 'Storage endpoints must use HTTPS in production' })
  }
  const [existing] = await rows<{ storage_secret_access_key: string | null; storage_access_key_id: string | null }>(
    'SELECT storage_secret_access_key,storage_access_key_id FROM products.store WHERE id=true AND organization_id=$1',
    [context.organizationId]
  )
  const secret =
    input.secretAccessKey ||
    (existing?.storage_secret_access_key ? decryptStorageSecret(existing.storage_secret_access_key) : '')
  const accessKeyId = input.provider === 'bunny' ? '' : input.accessKeyId || existing?.storage_access_key_id || ''
  if (!secret || (input.provider === 's3' && !accessKeyId)) {
    throw createError({ statusCode: 422, message: 'Access credentials are required' })
  }
  const config: StorageConfiguration = {
    provider: input.provider,
    source: 'store',
    endpoint: input.endpoint || (input.provider === 'bunny' ? 'https://storage.bunnycdn.com' : undefined),
    region: input.region,
    bucket: input.bucket,
    pathStyle: input.pathStyle,
    credentials: { accessKeyId, secretAccessKey: secret },
    tested: false
  }
  try {
    await testStorageConfiguration(config)
  } catch {
    throw createError({ statusCode: 422, message: 'Storage connection failed' })
  }
  await rows(
    `INSERT INTO products.store(id,organization_id,actor_id,storage_provider,storage_endpoint,storage_region,storage_bucket,storage_access_key_id,
    storage_secret_access_key,storage_path_style,storage_tested_at) VALUES(true,$1,$2,$3,$4,$5,$6,$7,$8,$9,now())
    ON CONFLICT(id) DO UPDATE SET storage_provider=$3,storage_endpoint=$4,storage_region=$5,storage_bucket=$6,storage_access_key_id=$7,
    storage_secret_access_key=$8,storage_path_style=$9,storage_tested_at=now(),actor_id=$2 WHERE products.store.organization_id=$1`,
    [
      context.organizationId,
      context.session.user.id,
      input.provider,
      input.endpoint || (input.provider === 'bunny' ? 'https://storage.bunnycdn.com' : null),
      input.region,
      input.bucket,
      accessKeyId,
      encryptStorageSecret(secret),
      input.pathStyle
    ]
  )
  return { configured: true, tested: true }
})
