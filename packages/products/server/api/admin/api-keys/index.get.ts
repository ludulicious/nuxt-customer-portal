import { auth } from '@nuxt-customer-portal/core/server/utils/auth'
import { apiKeyAdmin } from '@nuxt-customer-portal/products/server/utils/access'

export default defineEventHandler(async (event) => {
  const { organizationId } = await apiKeyAdmin(event)
  const result = await auth.api.listApiKeys({ headers: event.headers, query: { organizationId, sortDirection: 'desc' } })
  return result.apiKeys.map((key) => ({
    id: key.id,
    name: key.name,
    prefix: key.start ?? key.prefix,
    expiresAt: key.expiresAt,
    enabled: key.enabled,
    lastUsedAt: key.lastRequest,
    createdAt: key.createdAt,
    permissions: key.permissions ?? {}
  }))
})
