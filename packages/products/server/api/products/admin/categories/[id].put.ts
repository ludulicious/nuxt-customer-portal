import { admin } from '@nuxt-customer-portal/products/server/utils/access'
import { saveCategory } from '@nuxt-customer-portal/products/server/utils/categories'

export default defineEventHandler(async (event) =>
  saveCategory((await admin(event)).organizationId, await readBody(event), getRouterParam(event, 'id')!)
)
