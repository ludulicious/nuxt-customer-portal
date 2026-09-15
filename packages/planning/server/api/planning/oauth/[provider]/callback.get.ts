import { defineEventHandler, getRouterParam, getQuery, sendRedirect } from 'h3'
import { finishOAuth, oauthProvider } from '../../../../utils/oauth'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  await finishOAuth(
    event,
    oauthProvider(getRouterParam(event, 'provider')),
    String(query.state || ''),
    String(query.code || '')
  )
  return sendRedirect(event, '/planning/settings?connected=1', 303)
})
