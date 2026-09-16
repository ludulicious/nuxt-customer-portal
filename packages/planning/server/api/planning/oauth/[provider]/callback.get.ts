import { defineEventHandler, getRouterParam, getQuery, sendRedirect } from 'h3'
import { finishOAuth, oauthProvider } from '../../../../utils/oauth'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  try {
    await finishOAuth(
      event,
      oauthProvider(getRouterParam(event, 'provider')),
      String(query.state || ''),
      String(query.code || '')
    )
    return sendRedirect(event, '/planning/settings?tab=meeting&connection=connected', 303)
  } catch (error) {
    console.error('Planning OAuth callback failed', error)
    return sendRedirect(event, '/planning/settings?tab=meeting&connection=error', 303)
  }
})
