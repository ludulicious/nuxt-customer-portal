import { admin } from '@nuxt-customer-portal/products/server/utils/access'
import { deleteCategory } from '@nuxt-customer-portal/products/server/utils/categories'

export default defineEventHandler(async (event) => {
  await deleteCategory((await admin(event)).organizationId, getRouterParam(event, 'id')!, await readBody(event))
  return { ok: true }
})
