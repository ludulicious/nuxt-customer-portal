import { requireClientProfileManager } from '@nuxt-customer-portal/clients/server/utils/client-access'
import { getClient, updateClient } from '@nuxt-customer-portal/clients/server/utils/client-repository'
import { clientUpdateSchema } from '@nuxt-customer-portal/clients/server/utils/client-validation'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')!
  await requireClientProfileManager(event, id)
  await updateClient(id, clientUpdateSchema.parse(await readBody(event)))
  return getClient(id)
})
