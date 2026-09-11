import type { MarkdownStyle } from '../../shared/markdown-style'
import type { ImagePolicy } from '../../shared/types'
import { createHash } from 'node:crypto'
import { createError, getHeader, getRequestIP, type H3Event } from 'h3'
import { getPortalOrganization, requireFeatureAccess } from '@nuxt-customer-portal/core/server/portal'
import { auth } from '@nuxt-customer-portal/core/server/utils/auth'
import { productsFeature } from '../../shared/feature'
import { rows } from './database'

export const hash = (value: string) => createHash('sha256').update(value).digest('hex')

export interface Store {
  organization_id: string
  actor_id: string
  enabled: boolean
  markdown_style: MarkdownStyle
  currency_tax_behavior: Record<string, 'inclusive' | 'exclusive'>
  currencies: string[]
  languages: ('en' | 'nl')[]
  default_locale: 'en' | 'nl'
  image_policy: ImagePolicy
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
  if (context.organizationType !== 'PROVIDER' || (context.role !== 'owner' && context.role !== 'admin')) {
    throw createError({ statusCode: 403, message: 'API keys are only available to provider organization administrators' })
  }
  const [store] = await rows<Store>('SELECT * FROM products.store WHERE id=true')
  if (store && store.organization_id !== context.organizationId) {
    throw createError({ statusCode: 403, message: 'This organization does not own the store' })
  }
  return context
}
export async function apiKeyAdmin(event: H3Event) {
  const context = await admin(event)
  if (context.session.user.role !== 'admin') {
    throw createError({ statusCode: 403, message: 'System administrator access is required to manage API keys' })
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
  const token = getHeader(event, 'authorization')?.match(/^Bearer\s+([^\s]+)$/)?.[1]
  if (!token) {
    throw createError({ statusCode: 401, message: 'A catalog API key is required' })
  }
  const result = await auth.api.verifyApiKey({
    body: { key: token, permissions: { 'products.catalog': ['read'] } }
  })
  if (!result.valid || !result.key) {
    throw createError({ statusCode: 401, message: 'Invalid or expired API key' })
  }
  const store = await getStore(true)
  const organization = await getPortalOrganization(result.key.referenceId)
  if (organization?.organizationType !== 'PROVIDER' || store.organization_id !== result.key.referenceId) {
    throw createError({ statusCode: 403, message: 'Store access denied' })
  }
  return store
}
export const baseUrl = () => {
  const value = process.env.BETTER_AUTH_URL || process.env.PUBLIC_URL
  if (!value) {
    throw createError({ statusCode: 503, message: 'Configure the portal public URL' })
  }
  return new URL(value).origin
}
