import { createError, getHeader, getRequestIP, type H3Event } from 'h3'
import { auth } from '@nuxt-customer-portal/core/server/utils/auth'
import { getPortalOrganization } from '@nuxt-customer-portal/core/server/portal'
import { admin, getStore, rateLimit } from './access'

export function mediaPermission(permissions: Record<string, string[]> | null | undefined, action: 'read' | 'manage') {
  const scopes = permissions?.['products.media'] || []
  return scopes.includes('manage') || (action === 'read' && scopes.includes('read'))
}
export async function mediaAccess(event: H3Event, action: 'read' | 'manage' = 'read') {
  const authorization = getHeader(event, 'authorization')
  if (!authorization) {
    return { storeId: (await admin(event)).organizationId, manage: true }
  }
  await rateLimit(`media:${getRequestIP(event) || 'unknown'}`, 120)
  const token = authorization.match(/^Bearer\s+([^\s]+)$/)?.[1]
  if (!token) {
    throw createError({ statusCode: 401, message: 'A valid media API key is required' })
  }
  const result = await auth.api.verifyApiKey({ body: { key: token } })
  if (!result.valid || !result.key) {
    throw createError({ statusCode: 401, message: 'Invalid or expired API key' })
  }
  const permissions = result.key.permissions
  if (!mediaPermission(permissions, action)) {
    throw createError({ statusCode: 403, message: 'Missing media permission' })
  }
  const store = await getStore()
  const organization = await getPortalOrganization(result.key.referenceId)
  if (organization?.organizationType !== 'PROVIDER' || store.organization_id !== result.key.referenceId) {
    throw createError({ statusCode: 403, message: 'Store access denied' })
  }
  return { storeId: store.organization_id, manage: mediaPermission(permissions, 'manage') }
}
