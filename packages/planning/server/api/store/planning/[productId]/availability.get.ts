import { defineEventHandler, getQuery, getRouterParam } from 'h3'
import { available } from '@nuxt-customer-portal/planning/server/utils/booking'
import { publicLimit } from '@nuxt-customer-portal/products/server/utils/access'

export default defineEventHandler(async (event) => {
  await publicLimit(event)
  return available(getRouterParam(event, 'productId')!, getQuery(event))
})
