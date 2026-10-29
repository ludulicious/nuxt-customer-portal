import { admin } from '@nuxt-customer-portal/products/server/utils/access'
import { startUpload } from '@nuxt-customer-portal/products/server/utils/storage'

export default defineEventHandler(async (event) => {
  const { organizationId } = await admin(event)
  const body = await readBody(event)
  if (body?.visibility === 'public') {
    throw createError({ statusCode: 400, message: 'Choose product images from the media library' })
  }
  return startUpload(organizationId, getRouterParam(event, 'id')!, body)
})
