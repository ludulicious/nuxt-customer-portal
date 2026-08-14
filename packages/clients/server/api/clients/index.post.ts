import { requireOwnerClientManager } from '@nuxt-customer-portal/clients/server/utils/client-access'
import { createClient, getClient } from '@nuxt-customer-portal/clients/server/utils/client-repository'
import { genericClientCreateSchema } from '@nuxt-customer-portal/clients/server/utils/client-validation'

export default defineEventHandler(async (event) => {
  const { session } = await requireOwnerClientManager(event)
  const input = genericClientCreateSchema.parse(await readBody(event))
  const organizationId = await createClient(session.user.id, input)
  return getClient(organizationId)
})
