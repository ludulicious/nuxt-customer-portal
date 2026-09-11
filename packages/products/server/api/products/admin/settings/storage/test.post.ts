import { admin } from '@nuxt-customer-portal/products/server/utils/access'
import { rows } from '@nuxt-customer-portal/products/server/utils/database'
import { parseInput } from '@nuxt-customer-portal/products/server/utils/validation'
import { storageSettingsSchema } from '@nuxt-customer-portal/products/shared/validation'
import {
  decryptStorageSecret,
  environmentStorageConfigured,
  resolveStorageConfiguration,
  testStorageConfiguration,
  type StorageConfiguration
} from '@nuxt-customer-portal/products/server/utils/storage-configuration'

export default defineEventHandler(async (event) => {
  const context = await admin(event)
  let config: StorageConfiguration
  if (environmentStorageConfigured()) {
    config = await resolveStorageConfiguration()
  } else {
    const input = parseInput(storageSettingsSchema, await readBody(event))
    if (process.env.NODE_ENV === 'production' && input.endpoint && !input.endpoint.startsWith('https://')) {
      throw createError({ statusCode: 422, message: 'Storage endpoints must use HTTPS in production' })
    }
    const [existing] = await rows<{
      storage_secret_access_key: string | null
      storage_access_key_id: string | null
    }>(
      'SELECT storage_secret_access_key,storage_access_key_id FROM products.store WHERE id=true AND organization_id=$1',
      [context.organizationId]
    )
    const secret = input.secretAccessKey || (existing?.storage_secret_access_key
      ? decryptStorageSecret(existing.storage_secret_access_key)
      : '')
    const accessKeyId = input.provider === 'bunny' ? '' : input.accessKeyId || existing?.storage_access_key_id || ''
    if (!secret || (input.provider === 's3' && !accessKeyId)) {
      throw createError({ statusCode: 422, message: 'Access credentials are required' })
    }
    config = {
      provider: input.provider,
      source: 'store',
      endpoint: input.endpoint || (input.provider === 'bunny' ? 'https://storage.bunnycdn.com' : undefined),
      region: input.region,
      bucket: input.bucket,
      pathStyle: input.pathStyle,
      credentials: { accessKeyId, secretAccessKey: secret },
      tested: false
    }
  }
  try {
    await testStorageConfiguration(config)
  } catch (error) {
    const message = error instanceof Error && error.message.startsWith('Bunny Storage')
      ? error.message
      : 'Storage connection failed'
    throw createError({ statusCode: 422, message })
  }
  return { ok: true, source: config.source }
})
