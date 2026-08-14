import { requireOwnerClientManager } from '@nuxt-customer-portal/clients/server/utils/client-access'
import { listGenericClientsPage } from '@nuxt-customer-portal/clients/server/utils/client-repository'
import { genericClientListQuerySchema } from '@nuxt-customer-portal/clients/server/utils/client-validation'

export default defineEventHandler(async (event) => {
  await requireOwnerClientManager(event)
  return listGenericClientsPage(genericClientListQuerySchema.parse(getQuery(event)))
})
