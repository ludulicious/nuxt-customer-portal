import { auth } from '@nuxt-customer-portal/core/server/utils/auth'
import { checkOrganizationPermission } from '@nuxt-customer-portal/core/server/utils/permissions'
import { changePendingInvitation } from '@nuxt-customer-portal/core/server/utils/invitation-management'

export default defineEventHandler(async (event) => {
  const session = await auth.api.getSession({ headers: event.headers })
  if (!session?.user) {
throw createError({ statusCode: 401, message: 'Unauthorized' })
}
  const organizationId = getRouterParam(event, 'id')!
  if (
    !(await checkOrganizationPermission(session, organizationId, 'invitation', 'create')) ||
    !(await checkOrganizationPermission(session, organizationId, 'invitation', 'cancel'))
  ) {
    throw createError({ statusCode: 403, message: 'Access denied' })
  }
  return changePendingInvitation(organizationId, getRouterParam(event, 'invitationId')!, await readBody(event))
})
