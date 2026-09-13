import { defineEventHandler, readBody, getRouterParam } from 'h3'
import { setEnabled } from '@nuxt-customer-portal/planning/server/utils/management'
import { sameOrigin } from '@nuxt-customer-portal/planning/server/utils/access'

export default defineEventHandler(async (event) => {
  sameOrigin(event)
  return setEnabled(event, getRouterParam(event, 'userId')!, await readBody(event))
})
