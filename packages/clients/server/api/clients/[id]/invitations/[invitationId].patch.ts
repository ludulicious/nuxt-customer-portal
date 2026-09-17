import { changePendingInvitation } from '@nuxt-customer-portal/core/server/utils/invitation-management'
import { requireClientMemberManager } from '@nuxt-customer-portal/clients/server/utils/client-access'

export default defineEventHandler(async (event) => {
  const organizationId = getRouterParam(event, 'id')!
  await requireClientMemberManager(event, organizationId)
  return changePendingInvitation(organizationId, getRouterParam(event, 'invitationId')!, await readBody(event))
})
