import { rows } from '@nuxt-customer-portal/products/server/utils/database'
import { admin } from '@nuxt-customer-portal/products/server/utils/access'
import { saveProduct } from '@nuxt-customer-portal/products/server/utils/catalog'
import { parseInput } from '@nuxt-customer-portal/products/server/utils/validation'
import { productCreateSchema } from '@nuxt-customer-portal/products/shared/validation'

export default defineEventHandler(async (event) => {
  const { organizationId, session } = await admin(event)
  await rows('INSERT INTO products.store(organization_id,actor_id) VALUES($1,$2) ON CONFLICT(id) DO NOTHING', [
    organizationId,
    session.user.id
  ])
  return saveProduct(organizationId, parseInput(productCreateSchema, await readBody(event)))
})
