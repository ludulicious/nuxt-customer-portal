import { requireClientProfileManager } from '@nuxt-customer-portal/clients/server/utils/client-access'
import { getClient, updateClient } from '@nuxt-customer-portal/clients/server/utils/client-repository'
import { clientUpdateSchema } from '@nuxt-customer-portal/clients/server/utils/client-validation'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')!
  await requireClientProfileManager(event, id)
  const parsed = clientUpdateSchema.safeParse(await readBody(event))
  if (!parsed.success) {
    throw createError({ statusCode: 400, message: 'Invalid client details', data: { issues: parsed.error.issues } })
  }
  await updateClient(id, parsed.data)
  return getClient(id)
})
