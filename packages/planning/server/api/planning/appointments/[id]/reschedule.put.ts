import { defineEventHandler, getRouterParam, readBody } from 'h3'
import { sameOrigin } from '@nuxt-customer-portal/planning/server/utils/access'
import { staffReschedule } from '@nuxt-customer-portal/planning/server/utils/staff-appointments'

export default defineEventHandler(async (event) => {
  sameOrigin(event)
  return staffReschedule(event, getRouterParam(event, 'id')!, await readBody(event))
})
