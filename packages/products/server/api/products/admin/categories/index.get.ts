import { admin } from '@nuxt-customer-portal/products/server/utils/access'
import { listCategories } from '@nuxt-customer-portal/products/server/utils/categories'

export default defineEventHandler(async (event) => listCategories((await admin(event)).organizationId))
