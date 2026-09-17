import { admin } from '@nuxt-customer-portal/products/server/utils/access'
import { categoryPage } from '@nuxt-customer-portal/products/server/utils/categories'

export default defineEventHandler(async (event) => categoryPage((await admin(event)).organizationId, getQuery(event)))
