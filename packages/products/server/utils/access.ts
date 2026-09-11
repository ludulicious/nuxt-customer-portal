import type { MarkdownStyle } from '../../shared/markdown-style'
import { createHash, randomBytes } from 'node:crypto'
import { createError, getHeader, getRequestIP, type H3Event } from 'h3'
import { requireFeatureAccess } from '@nuxt-customer-portal/core/server/portal'
import { productsFeature } from '../../shared/feature'
import { rows } from './database'

export const hash = (value: string) => createHash('sha256').update(value).digest('hex')
export const newKey = () => `store_${randomBytes(32).toString('base64url')}`
export interface Store {
  organization_id: string
  actor_id: string
  enabled: boolean
  markdown_style: MarkdownStyle
  currency_tax_behavior: Record<string, 'inclusive' | 'exclusive'>
  currencies: string[]
  languages: ('en' | 'nl')[]
  default_locale: 'en' | 'nl'
}
export async function getStore(active = false) {
  const [store] = await rows<Store>('SELECT * FROM products.store WHERE id=true')
  if (!store || (active && !store.enabled)) {
    throw createError({ statusCode: 503, message: 'Store is not available' })
  }
  return store
}
export async function admin(event: H3Event) {
  const context = await requireFeatureAccess(event, productsFeature.policy, 'manage')
  const [store] = await rows<Store>('SELECT * FROM products.store WHERE id=true')
  if (store && store.organization_id !== context.organizationId) {
    throw createError({ statusCode: 403, message: 'This organization does not own the store' })
  }
  return context
}
export async function rateLimit(id: string, limit: number) {
  const window = Math.floor(Date.now() / 60000)
  const [row] = await rows<{ count: number }>(
    `INSERT INTO products.rate_limit(id,bucket_minute,count) VALUES($1,$2,1) ON CONFLICT(id) DO UPDATE SET bucket_minute=$2,count=CASE WHEN products.rate_limit.bucket_minute=$2 THEN products.rate_limit.count+1 ELSE 1 END RETURNING count`,
    [hash(id), window]
  )
  if (row!.count > limit) {
    throw createError({ statusCode: 429, message: 'Too many requests; retry in one minute' })
  }
}
export async function publicLimit(event: H3Event) {
  await rateLimit(`public:${getRequestIP(event) || 'unknown'}`, 30)
}
export async function catalogAccess(event: H3Event) {
  await rateLimit(`auth:${getRequestIP(event) || 'unknown'}`, 120)
  const token = getHeader(event, 'authorization')?.match(/^Bearer (store_[A-Za-z0-9_-]{43})$/)?.[1]
  if (!token) {
    throw createError({ statusCode: 401, message: 'A catalog API key is required' })
  }
  const [key] = await rows<{ id: string; store_id: string }>(
    `UPDATE products.api_key SET last_used_at=now() WHERE hash=$1 AND revoked_at IS NULL AND (expires_at IS NULL OR expires_at>now()) RETURNING id,store_id`,
    [hash(token)]
  )
  if (!key) {
    throw createError({ statusCode: 401, message: 'Invalid or expired API key' })
  }
  const store = await getStore(true)
  if (store.organization_id !== key.store_id) {
    throw createError({ statusCode: 403, message: 'Store access denied' })
  }
  await rateLimit(`key:${key.id}`, 120)
  return store
}
export const baseUrl = () => {
  const value = process.env.BETTER_AUTH_URL || process.env.PUBLIC_URL
  if (!value) {
    throw createError({ statusCode: 503, message: 'Configure the portal public URL' })
  }
  return new URL(value).origin
}
