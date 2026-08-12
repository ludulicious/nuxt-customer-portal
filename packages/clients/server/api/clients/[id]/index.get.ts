import { requireClientProfileManager } from '@nuxt-customer-portal/clients/server/utils/client-access'
import { getClient } from '@nuxt-customer-portal/clients/server/utils/client-repository'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')!
  await requireClientProfileManager(event, id)
  const selected = await getClient(id)
  if (!selected) throw createError({ statusCode: 404, message: 'Client not found' })
  return selected
})
