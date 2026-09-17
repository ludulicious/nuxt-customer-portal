import { defineEventHandler, getRouterParam, readBody } from 'h3'
import { sameOrigin } from '@nuxt-customer-portal/planning/server/utils/access'
import { saveProductPlanning } from '@nuxt-customer-portal/planning/server/utils/management'

export default defineEventHandler(async (event) => {
  sameOrigin(event)
  return saveProductPlanning(event, getRouterParam(event, 'id')!, await readBody(event))
})
