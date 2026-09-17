import { admin } from '@nuxt-customer-portal/products/server/utils/access'
import { categoryDeletion } from '@nuxt-customer-portal/products/server/utils/categories'

export default defineEventHandler(async (event) =>
  categoryDeletion((await admin(event)).organizationId, getRouterParam(event, 'id')!)
)
