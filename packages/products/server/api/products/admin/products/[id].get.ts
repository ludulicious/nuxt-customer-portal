import { z } from 'zod'
import { admin } from '@nuxt-customer-portal/products/server/utils/access'
import { getProduct } from '@nuxt-customer-portal/products/server/utils/catalog'
import { parseInput } from '@nuxt-customer-portal/products/server/utils/validation'

export default defineEventHandler(async (event) => {
  const { organizationId } = await admin(event)
  const id = parseInput(z.uuid(), getRouterParam(event, 'id'))
  return getProduct(organizationId, id)
})
