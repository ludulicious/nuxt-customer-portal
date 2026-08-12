import { requireOwnerClientManager } from '@nuxt-customer-portal/clients/server/utils/client-access'
import { getClient, setClientArchived } from '@nuxt-customer-portal/clients/server/utils/client-repository'
import { clientArchiveSchema } from '@nuxt-customer-portal/clients/server/utils/client-validation'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')!
  const { session } = await requireOwnerClientManager(event)
  const { archived } = clientArchiveSchema.parse(await readBody(event))
  await setClientArchived(id, session.user.id, archived)
  return getClient(id)
})
