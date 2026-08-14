import { requireOwnerClientManager } from '@nuxt-customer-portal/clients/server/utils/client-access'
import { getGenericClientDeletionEligibility } from '@nuxt-customer-portal/clients/server/utils/client-repository'

export default defineEventHandler(async (event) => {
  await requireOwnerClientManager(event)
  return getGenericClientDeletionEligibility(getRouterParam(event, 'id')!)
})
