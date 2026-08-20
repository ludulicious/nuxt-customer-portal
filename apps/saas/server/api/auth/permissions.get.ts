import { statement } from '@nuxt-customer-portal/core/shared/permissions'
import { platformAuth } from '../../utils/platform-auth'
import { isPlatformAdminEmail } from '../../utils/platform-admin'

export default defineEventHandler(async (event) => {
  const session = await platformAuth.api.getSession({ headers: event.headers })
  if (!session?.user) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  const role = isPlatformAdminEmail(session.user.email) ? 'admin' : 'user'
  const permissions: Record<string, boolean> = {}
  for (const [subject, actions] of Object.entries(statement)) {
    for (const action of actions) {
      permissions[`${subject}.${action}`] = role === 'admin'
    }
  }

  return {
    permissions,
    role,
    organizationRole: null,
    activeOrganization: null,
    organizationType: null
  }
})
