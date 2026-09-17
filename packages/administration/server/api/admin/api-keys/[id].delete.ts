import { auth } from '@nuxt-customer-portal/core/server/utils/auth'
import { requireApiKeyAdmin } from '../../../utils/api-key-admin'

export default defineEventHandler(async (event) => {
  await requireApiKeyAdmin(event)
  const result = await auth.api.deleteApiKey({
    headers: event.headers,
    body: { keyId: getRouterParam(event, 'id')! }
  })
  if (!result.success) {
    throw createError({ statusCode: 500, message: 'API key could not be deleted' })
  }
  setHeader(event, 'Cache-Control', 'no-store')
  return { ok: true }
})
