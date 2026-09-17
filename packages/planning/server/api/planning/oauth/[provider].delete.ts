import { defineEventHandler, getRouterParam } from 'h3'
import { providerAccess, sameOrigin } from '../../../utils/access'
import { oauthProvider } from '../../../utils/oauth'
import { rows } from '@nuxt-customer-portal/products/server/utils/database'

export default defineEventHandler(async (event) => {
  sameOrigin(event)
  const { storeId, userId } = await providerAccess(event)
  await rows('DELETE FROM planning.connection WHERE store_id=$1 AND user_id=$2 AND provider=$3', [
    storeId,
    userId,
    oauthProvider(getRouterParam(event, 'provider'))
  ])
  return { success: true }
})
