import { requireOwnerClientManager } from '@nuxt-customer-portal/clients/server/utils/client-access'
import { getClient, setClientModule } from '@nuxt-customer-portal/clients/server/utils/client-repository'
import { clientModuleUpdateSchema } from '@nuxt-customer-portal/clients/server/utils/client-validation'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')!
  const moduleId = getRouterParam(event, 'moduleId')!
  const { session } = await requireOwnerClientManager(event)
  const { enabled } = clientModuleUpdateSchema.parse(await readBody(event))
  await setClientModule(id, session.user.id, moduleId, enabled)
  return getClient(id)
})
