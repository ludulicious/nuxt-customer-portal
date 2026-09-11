import { createCipheriv, createDecipheriv, createHash, randomBytes, randomUUID } from 'node:crypto'
import { DeleteObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { createError } from 'h3'
import { rows } from './database'
import type { StorageSettings } from '../../shared/types'

export interface StorageConfiguration {
  provider: 's3' | 'bunny'
  endpoint?: string
  region: string
  bucket: string
  pathStyle: boolean
  credentials?: { accessKeyId: string; secretAccessKey: string }
  source: 'environment' | 'store'
  tested: boolean
}
interface StorageRow {
  storage_provider: 's3' | 'bunny'
  storage_endpoint: string | null
  storage_region: string | null
  storage_bucket: string | null
  storage_access_key_id: string | null
  storage_secret_access_key: string | null
  storage_path_style: boolean
  storage_tested_at: string | null
}
const environmentProvider = () => (process.env.PRODUCTS_STORAGE_PROVIDER === 'bunny' ? 'bunny' : 's3')
export const defaultBunnyStorageEndpoint = 'https://storage.bunnycdn.com'
const encryptionKey = () => {
  const value = process.env.PRODUCTS_STORAGE_ENCRYPTION_KEY
  if (!value) {
    throw createError({ statusCode: 503, message: 'Configure PRODUCTS_STORAGE_ENCRYPTION_KEY' })
  }
  return createHash('sha256').update(value).digest()
}
export const encryptStorageSecret = (value: string) => {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv)
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()])
  return [
    'v1',
    iv.toString('base64url'),
    cipher.getAuthTag().toString('base64url'),
    encrypted.toString('base64url')
  ].join('.')
}
export const decryptStorageSecret = (value: string) => {
  const [version, iv, tag, encrypted] = value.split('.')
  if (version !== 'v1' || !iv || !tag || !encrypted) {
    throw new Error('Stored storage credential has an invalid format')
  }
  try {
    const decipher = createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(iv, 'base64url'))
    decipher.setAuthTag(Buffer.from(tag, 'base64url'))
    return Buffer.concat([decipher.update(Buffer.from(encrypted, 'base64url')), decipher.final()]).toString('utf8')
  } catch {
    throw new Error('Stored storage credential could not be decrypted')
  }
}
export const environmentStorageConfigured = () =>
  environmentProvider() === 'bunny'
    ? Boolean(process.env.PRODUCTS_BUNNY_STORAGE_ZONE && process.env.PRODUCTS_BUNNY_STORAGE_PASSWORD)
    : Boolean(process.env.PRODUCTS_S3_BUCKET)
export const createStorageClient = (config: StorageConfiguration) =>
  new S3Client({
    region: config.region,
    endpoint: config.endpoint,
    forcePathStyle: config.pathStyle,
    credentials: config.credentials
  })
export const resolveStorageConfiguration = async (): Promise<StorageConfiguration> => {
  if (environmentStorageConfigured()) {
    if (environmentProvider() === 'bunny') {
      return {
        provider: 'bunny',
        source: 'environment',
        bucket: process.env.PRODUCTS_BUNNY_STORAGE_ZONE!,
        region: '',
        endpoint: process.env.PRODUCTS_BUNNY_STORAGE_ENDPOINT || defaultBunnyStorageEndpoint,
        pathStyle: false,
        credentials: { accessKeyId: '', secretAccessKey: process.env.PRODUCTS_BUNNY_STORAGE_PASSWORD! },
        tested: true
      }
    }
    return {
      provider: 's3',
      source: 'environment',
      bucket: process.env.PRODUCTS_S3_BUCKET!,
      region: process.env.PRODUCTS_S3_REGION || 'us-east-1',
      endpoint: process.env.PRODUCTS_S3_ENDPOINT || undefined,
      pathStyle: process.env.PRODUCTS_S3_PATH_STYLE === 'true' || Boolean(process.env.PRODUCTS_S3_ENDPOINT),
      tested: true
    }
  }
  const [row] = await rows<StorageRow>(
    'SELECT storage_provider,storage_endpoint,storage_region,storage_bucket,storage_access_key_id,storage_secret_access_key,storage_path_style,storage_tested_at FROM products.store WHERE id=true'
  )
  if (
    !row?.storage_bucket ||
    !row.storage_secret_access_key ||
    (row.storage_provider !== 'bunny' && (!row.storage_region || !row.storage_access_key_id))
  ) {
    throw createError({ statusCode: 503, message: 'Configure product file storage' })
  }
  return {
    provider: row.storage_provider || 's3',
    source: 'store',
    endpoint: row.storage_endpoint || (row.storage_provider === 'bunny' ? defaultBunnyStorageEndpoint : undefined),
    region: row.storage_region || '',
    bucket: row.storage_bucket,
    pathStyle: row.storage_path_style,
    tested: Boolean(row.storage_tested_at),
    credentials: {
      accessKeyId: row.storage_access_key_id || '',
      secretAccessKey: decryptStorageSecret(row.storage_secret_access_key)
    }
  }
}
export const storageSummary = async (): Promise<StorageSettings> => {
  if (environmentStorageConfigured()) {
    if (environmentProvider() === 'bunny') {
      return {
        provider: 'bunny',
        source: 'environment',
        configured: true,
        tested: true,
        endpoint: process.env.PRODUCTS_BUNNY_STORAGE_ENDPOINT || defaultBunnyStorageEndpoint,
        region: '',
        bucket: process.env.PRODUCTS_BUNNY_STORAGE_ZONE!,
        pathStyle: false,
        accessKeySuffix: ''
      }
    }
    return {
      provider: 's3',
      source: 'environment',
      configured: true,
      tested: true,
      endpoint: process.env.PRODUCTS_S3_ENDPOINT || '',
      region: process.env.PRODUCTS_S3_REGION || 'us-east-1',
      bucket: process.env.PRODUCTS_S3_BUCKET!,
      pathStyle: process.env.PRODUCTS_S3_PATH_STYLE === 'true' || Boolean(process.env.PRODUCTS_S3_ENDPOINT),
      accessKeySuffix: ''
    }
  }
  const [row] = await rows<StorageRow>(
    'SELECT storage_provider,storage_endpoint,storage_region,storage_bucket,storage_access_key_id,storage_secret_access_key,storage_path_style,storage_tested_at FROM products.store WHERE id=true'
  )
  const configured = Boolean(
    row?.storage_bucket &&
      row.storage_secret_access_key &&
      (row.storage_provider === 'bunny' || (row.storage_region && row.storage_access_key_id))
  )
  return {
    provider: row?.storage_provider || 's3',
    source: configured ? 'store' : 'missing',
    configured,
    tested: Boolean(row?.storage_tested_at),
    endpoint: row?.storage_endpoint || (row?.storage_provider === 'bunny' ? defaultBunnyStorageEndpoint : ''),
    region: row?.storage_region || 'us-east-1',
    bucket: row?.storage_bucket || '',
    pathStyle: row?.storage_path_style || false,
    accessKeySuffix: row?.storage_access_key_id?.slice(-4) || ''
  }
}
export const testStorageConfiguration = async (config: StorageConfiguration) => {
  const key = `products/health/${randomUUID()}.txt`
  if (config.provider === 'bunny') {
    const url = `${config.endpoint!.replace(/\/$/, '')}/${encodeURIComponent(config.bucket)}/${key}`
    const headers = { AccessKey: config.credentials!.secretAccessKey }
    try {
      const upload = await fetch(url, {
        method: 'PUT',
        headers: { ...headers, 'Content-Type': 'text/plain' },
        body: 'ok'
      })
      if (!upload.ok) {
        throw new Error(bunnyTestFailure('write', upload.status))
      }
      const inspect = await fetch(url, { headers })
      if (!inspect.ok) {
        throw new Error(bunnyTestFailure('read', inspect.status))
      }
      await inspect.body?.cancel()
    } finally {
      await fetch(url, { method: 'DELETE', headers }).catch(() => undefined)
    }
    return
  }
  const client = createStorageClient(config)
  try {
    await client.send(
      new PutObjectCommand({ Bucket: config.bucket, Key: key, Body: '', ContentType: 'application/octet-stream' })
    )
    await client.send(new HeadObjectCommand({ Bucket: config.bucket, Key: key }))
  } finally {
    await client.send(new DeleteObjectCommand({ Bucket: config.bucket, Key: key })).catch(() => undefined)
    client.destroy()
  }
}

const bunnyTestFailure = (operation: string, status: number) => {
  if (status === 401) {
    return 'Bunny Storage rejected the Storage Zone password.'
  }
  if (status === 404) {
    return 'Bunny Storage could not find this Storage Zone at the selected endpoint.'
  }
  if (status === 403) {
    return 'Bunny Storage denied access to this Storage Zone.'
  }
  if (status >= 500) {
    return 'Bunny Storage is temporarily unavailable.'
  }
  return `Bunny Storage could not ${operation} the connection probe (HTTP ${status}).`
}
