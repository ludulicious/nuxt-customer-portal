import { admin } from '@nuxt-customer-portal/products/server/utils/access'
import { finishUpload } from '@nuxt-customer-portal/products/server/utils/storage'

export default defineEventHandler(async (event) => {
  const { organizationId } = await admin(event)
  return finishUpload(
    organizationId,
    getRouterParam(event, 'id')!,
    getRouterParam(event, 'assetId')!,
    await readBody(event)
  )
})
