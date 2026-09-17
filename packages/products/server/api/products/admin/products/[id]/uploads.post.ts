import { admin } from '@nuxt-customer-portal/products/server/utils/access'
import { startUpload } from '@nuxt-customer-portal/products/server/utils/storage'

export default defineEventHandler(async (event) => {
  const { organizationId } = await admin(event)
  return startUpload(organizationId, getRouterParam(event, 'id')!, await readBody(event))
})
