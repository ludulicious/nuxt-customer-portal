import { admin } from '@nuxt-customer-portal/products/server/utils/access'
import { deleteProduct } from '@nuxt-customer-portal/products/server/utils/catalog'

export default defineEventHandler(async (event) => {
  const { organizationId } = await admin(event)
  await deleteProduct(organizationId, getRouterParam(event, 'id')!, String((await readBody(event))?.name || ''))
  return { ok: true }
})
