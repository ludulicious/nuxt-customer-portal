import { createHash } from 'node:crypto'
import { createPortalAuth } from '@nuxt-customer-portal/core/server/utils/auth'
import type { PortalRequestContext } from '@nuxt-customer-portal/core/server/portal'

const workspaceAuthInstances = new Map<string, ReturnType<typeof createPortalAuth>>()

export const getWorkspaceAuth = (workspace: NonNullable<PortalRequestContext['workspace']>) => {
  if (!workspace.authSecret) throw createError({ statusCode: 503, statusMessage: 'Workspace authentication secret is unavailable' })
  const secretVersion = createHash('sha256').update(workspace.authSecret).digest('hex').slice(0, 12)
  const key = `${workspace.id}:${workspace.canonicalDomain}:${secretVersion}`
  const existing = workspaceAuthInstances.get(key)
  if (existing) return existing
  const auth = createPortalAuth({
    baseURL: `https://${workspace.canonicalDomain}`,
    secret: workspace.authSecret,
    socialProvidersEnabled: false
  })
  workspaceAuthInstances.set(key, auth)
  return auth
}
