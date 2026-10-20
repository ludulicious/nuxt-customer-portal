import { defineEventHandler, getRouterParam, getQuery, sendRedirect } from 'h3'
import { finishOAuth, oauthProvider } from '../../../../utils/oauth'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const provider = oauthProvider(getRouterParam(event, 'provider'))
  const tab = provider === 'google' ? 'calendar' : 'meeting'
  try {
    await finishOAuth(event, provider, String(query.state || ''), String(query.code || ''))
    return sendRedirect(event, `/planning/settings?tab=${tab}&connection=connected`, 303)
  } catch (error) {
    console.error('Planning OAuth callback failed', error)
    const reason = (error as { data?: { reason?: string } }).data?.reason === 'permissions' ? 'permissions' : 'error'
    return sendRedirect(event, `/planning/settings?tab=${tab}&connection=${reason}`, 303)
  }
})
