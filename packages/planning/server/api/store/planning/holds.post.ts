import { defineEventHandler, readBody } from 'h3'
import { reserve } from '@nuxt-customer-portal/planning/server/utils/booking'
import { sameOrigin } from '@nuxt-customer-portal/planning/server/utils/access'
import { publicLimit } from '@nuxt-customer-portal/products/server/utils/access'

export default defineEventHandler(async (event) => {
  await publicLimit(event)
  sameOrigin(event)
  return reserve(event, await readBody(event))
})
