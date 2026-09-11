import { auth } from '@nuxt-customer-portal/core/server/utils/auth'
import { apiKeyAdmin } from '@nuxt-customer-portal/products/server/utils/access'

export default defineEventHandler(async (event) => {
  await apiKeyAdmin(event)
  await auth.api.deleteApiKey({ headers: event.headers, body: { keyId: getRouterParam(event, 'id')! } })
  return { ok: true }
})
