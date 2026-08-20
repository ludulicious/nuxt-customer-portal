import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import { enterPortalRequestContext, type PortalRequestContext } from '@nuxt-customer-portal/core/server/portal'
import { resolveTenantAuthSecret, resolveTenantDatabaseSecret } from './provider-adapters'

type TenantRecord = {
  id: string
  slug: string
  lifecycle_status: string
  canonical_domain: string
  database_secret_ref: string
  auth_secret_ref: string
  selected_modules: string[]
}

const pools = new Map<string, { pool: Pool, usedAt: number }>()
let platformPool: Pool | undefined
let controlPlanePool: Pool | undefined

// The SaaS app and the published core package can resolve different @types/pg
// instances through the workspace. Keep that dependency boundary local while
// exposing the shared request-context database shape.
const createDrizzle = drizzle as unknown as (client: unknown) => unknown
const databaseForPool = (pool: Pool) =>
  createDrizzle(pool) as PortalRequestContext['database']

const getPool = (url: string, key: string) => {
  const existing = pools.get(key)
  if (existing) {
    existing.usedAt = Date.now()
    return existing.pool
  }
  const maximum = Math.max(2, Number(process.env.SAAS_TENANT_POOL_CACHE_MAX || 25))
  if (pools.size >= maximum) {
    const oldest = [...pools.entries()].sort((left, right) => left[1].usedAt - right[1].usedAt)[0]
    if (oldest) {
      pools.delete(oldest[0])
      void oldest[1].pool.end()
    }
  }
  const pool = new Pool({ connectionString: url, max: 10, idleTimeoutMillis: 30_000 })
  pools.set(key, { pool, usedAt: Date.now() })
  return pool
}

export const getControlPlanePool = () => {
  controlPlanePool ||= getPool(process.env.DATABASE_URL || '', 'control-plane')
  return controlPlanePool
}

export const getPlatformDatabase = () => {
  platformPool ||= getPool(process.env.DATABASE_URL || '', 'platform')
  return databaseForPool(platformPool)
}

export const closeSaasPools = async () => {
  const active = [...new Set([...pools.values()].map(entry => entry.pool))]
  pools.clear()
  platformPool = undefined
  controlPlanePool = undefined
  await Promise.allSettled(active.map(pool => pool.end()))
}

const resolveTenant = async (hostname: string): Promise<TenantRecord | null> => {
  const result = await getControlPlanePool().query<TenantRecord>(
    `SELECT t.id, t.slug, t.lifecycle_status, t.canonical_domain, t.database_secret_ref, t.auth_secret_ref, t.selected_modules
     FROM platform_tenant t
     LEFT JOIN platform_domain d ON d.tenant_id = t.id
     WHERE (t.canonical_domain = $1 OR d.hostname = $1)
     LIMIT 1`,
    [hostname]
  )
  return result.rows[0] ?? null
}

export const establishSaasRequestContext = async (hostname: string) => {
  const config = useRuntimeConfig()
  const platformHost = String(config.public.platformHost || process.env.SAAS_PLATFORM_HOST || 'platform.localhost').toLowerCase()
  const platformDomain = String(config.public.platformDomain || process.env.SAAS_PLATFORM_DOMAIN || platformHost).toLowerCase()
  const localPlatformHost = process.env.NODE_ENV !== 'production'
    && ['localhost', '127.0.0.1', '::1'].includes(hostname)

  if (hostname === platformHost || hostname === platformDomain || localPlatformHost) {
    const context: PortalRequestContext = { database: getPlatformDatabase(), mode: 'platform' }
    enterPortalRequestContext(context)
    return context
  }

  const tenant = await resolveTenant(hostname)
  if (!tenant || tenant.lifecycle_status === 'DELETED') {
    throw createError({ statusCode: 404, statusMessage: 'Unknown tenant domain' })
  }
  if (tenant.lifecycle_status === 'READ_ONLY') {
    // Feature mutation guards can use this state through the request context.
  }

  const [url, authSecret] = await Promise.all([
    resolveTenantDatabaseSecret(tenant.id),
    resolveTenantAuthSecret(tenant.id)
  ])
  const context: PortalRequestContext = {
    database: databaseForPool(getPool(url, `tenant:${tenant.id}`)),
    mode: 'tenant',
    tenant: {
      id: tenant.id,
      slug: tenant.slug,
      lifecycleStatus: tenant.lifecycle_status,
      canonicalDomain: tenant.canonical_domain,
      enabledModules: tenant.selected_modules,
      authSecret
    }
  }
  enterPortalRequestContext(context)
  return context
}
