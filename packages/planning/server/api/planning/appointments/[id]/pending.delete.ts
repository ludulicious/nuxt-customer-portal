import { defineEventHandler, getRouterParam } from 'h3'
import { abandonChange } from '@nuxt-customer-portal/planning/server/utils/management'
import { sameOrigin } from '@nuxt-customer-portal/planning/server/utils/access'

export default defineEventHandler(async (event) => {
  sameOrigin(event)
  return abandonChange(event, getRouterParam(event, 'id')!)
})
