import { changePendingInvitation } from '@nuxt-customer-portal/core/server/utils/invitation-management'
import { requireClientProfileManager } from '@nuxt-customer-portal/clients/server/utils/client-access'

export default defineEventHandler(async (event) => {
  const organizationId = getRouterParam(event, 'id')!
  await requireClientProfileManager(event, organizationId)
  return changePendingInvitation(organizationId, getRouterParam(event, 'invitationId')!, await readBody(event))
})
