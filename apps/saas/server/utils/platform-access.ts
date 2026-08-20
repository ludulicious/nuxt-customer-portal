import { getPortalRequestContext } from '@nuxt-customer-portal/core/server/portal'
import { platformAuth } from './platform-auth'
import { isPlatformAdminEmail } from './platform-admin'

export const requirePlatformSession = async (event: { headers: Headers }) => {
  if (getPortalRequestContext()?.mode !== 'platform') {
    throw createError({ statusCode: 404, statusMessage: 'Not found' })
  }
  const session = await platformAuth.api.getSession({ headers: event.headers })
  if (!session?.user) throw createError({ statusCode: 401, statusMessage: 'Platform authentication required' })
  if (!isPlatformAdminEmail(session.user.email)) {
    throw createError({ statusCode: 403, statusMessage: 'Platform administrator access required' })
  }
  return session
}
