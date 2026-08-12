import { requireOwnerClientManager } from '@nuxt-customer-portal/clients/server/utils/client-access'
import { deleteGenericClient } from '@nuxt-customer-portal/clients/server/utils/client-repository'
import { genericClientDeleteSchema } from '@nuxt-customer-portal/clients/server/utils/client-validation'

export default defineEventHandler(async (event) => {
  await requireOwnerClientManager(event)
  const { clientName } = genericClientDeleteSchema.parse(await readBody(event))
  await deleteGenericClient(getRouterParam(event, 'id')!, clientName)
  return { success: true }
})
