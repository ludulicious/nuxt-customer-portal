import { auth } from '@nuxt-customer-portal/core/server/utils/auth'
import { parseApiKeyInput, requireApiKeyAdmin } from '../../../utils/api-key-admin'

export default defineEventHandler(async (event) => {
  const { organizationId, session } = await requireApiKeyAdmin(event)
  const input = parseApiKeyInput(await readBody(event))
  if (input.expiresAt && new Date(input.expiresAt) <= new Date()) {
    throw createError({ statusCode: 400, message: 'Expiry must be in the future' })
  }
  const permissions = input.scopes.reduce<Record<string, string[]>>((result, scope) => {
    const [resource, action] = scope.split(':') as [string, string]
    result[resource] = [...(result[resource] ?? []), action]
    return result
  }, {})
  const expiresIn = input.expiresAt
    ? Math.max(1, Math.floor((new Date(input.expiresAt).getTime() - Date.now()) / 1000))
    : null
  const created = await auth.api.createApiKey({
    body: {
      name: input.name,
      expiresIn,
      organizationId,
      userId: session.user.id,
      permissions,
      rateLimitEnabled: true,
      rateLimitTimeWindow: 60_000,
      rateLimitMax: 120
    }
  })
  setHeader(event, 'Cache-Control', 'no-store')
  return { id: created.id, key: created.key }
})
