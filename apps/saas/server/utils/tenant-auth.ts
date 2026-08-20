import { createHash } from 'node:crypto'
import { createPortalAuth } from '@nuxt-customer-portal/core/server/utils/auth'
import type { PortalRequestContext } from '@nuxt-customer-portal/core/server/portal'

const tenantAuthInstances = new Map<string, ReturnType<typeof createPortalAuth>>()

export const getTenantAuth = (tenant: NonNullable<PortalRequestContext['tenant']>) => {
  if (!tenant.authSecret) throw createError({ statusCode: 503, statusMessage: 'Tenant authentication secret is unavailable' })
  const secretVersion = createHash('sha256').update(tenant.authSecret).digest('hex').slice(0, 12)
  const key = `${tenant.id}:${tenant.canonicalDomain}:${secretVersion}`
  const existing = tenantAuthInstances.get(key)
  if (existing) return existing
  const auth = createPortalAuth({
    baseURL: `https://${tenant.canonicalDomain}`,
    secret: tenant.authSecret,
    socialProvidersEnabled: false
  })
  tenantAuthInstances.set(key, auth)
  return auth
}
