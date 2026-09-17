import { getPortalOrganization, requireActiveOrganization, requireSession } from '@nuxt-customer-portal/core/server'
import { createError, type H3Event } from 'h3'
import { apiKeySchema } from '../../shared/api-key'

export function parseApiKeyInput(value: unknown) {
  const result = apiKeySchema.safeParse(value)
  if (!result.success) {
    throw createError({ statusCode: 400, message: result.error.issues[0]?.message || 'Invalid input' })
  }
  return result.data
}

export async function requireApiKeyAdmin(event: H3Event) {
  const session = await requireSession(event)
  if (session.user.role !== 'admin') {
    throw createError({ statusCode: 403, message: 'System administrator access is required to manage API keys' })
  }
  const organizationId = requireActiveOrganization(session)
  const organization = await getPortalOrganization(organizationId)
  if (organization?.organizationType !== 'PROVIDER') {
    throw createError({ statusCode: 403, message: 'API keys are only available to provider organizations' })
  }
  return { organizationId, session }
}
