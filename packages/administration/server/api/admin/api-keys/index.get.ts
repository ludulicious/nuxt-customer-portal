import { auth } from '@nuxt-customer-portal/core/server/utils/auth'
import { requireApiKeyAdmin } from '../../../utils/api-key-admin'

export default defineEventHandler(async (event) => {
  const { organizationId } = await requireApiKeyAdmin(event)
  setHeader(event, 'Cache-Control', 'no-store')
  const result = await auth.api.listApiKeys({
    headers: event.headers,
    query: { organizationId, sortDirection: 'desc' }
  })
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
