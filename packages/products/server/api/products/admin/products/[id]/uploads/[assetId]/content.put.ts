import { admin } from '@nuxt-customer-portal/products/server/utils/access'
import { uploadBunnyObject } from '@nuxt-customer-portal/products/server/utils/storage'

export default defineEventHandler(async (event) => {
  const { organizationId } = await admin(event)
  return uploadBunnyObject(
    event,
    organizationId,
    getRouterParam(event, 'id')!,
    getRouterParam(event, 'assetId')!
  )
})
