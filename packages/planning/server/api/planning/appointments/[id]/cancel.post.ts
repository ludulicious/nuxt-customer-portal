import { defineEventHandler, getRouterParam } from 'h3'
import { cancel } from '@nuxt-customer-portal/planning/server/utils/management'
import { sameOrigin } from '@nuxt-customer-portal/planning/server/utils/access'

export default defineEventHandler(async (event) => {
  sameOrigin(event)
  return cancel(event, getRouterParam(event, 'id')!)
})
