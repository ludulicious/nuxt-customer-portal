import { defineEventHandler, readBody } from 'h3'
import { savePolicy } from '@nuxt-customer-portal/planning/server/utils/management'
import { sameOrigin } from '@nuxt-customer-portal/planning/server/utils/access'

export default defineEventHandler(async (event) => {
  sameOrigin(event)
  return savePolicy(event, await readBody(event))
})
