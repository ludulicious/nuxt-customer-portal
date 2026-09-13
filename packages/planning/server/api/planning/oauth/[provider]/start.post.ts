import { defineEventHandler, getRouterParam } from 'h3'
import { startOAuth, oauthProvider } from '../../../../utils/oauth'
import { sameOrigin } from '../../../../utils/access'

export default defineEventHandler(async (event) => {
  sameOrigin(event)
  return startOAuth(event, oauthProvider(getRouterParam(event, 'provider')))
})
