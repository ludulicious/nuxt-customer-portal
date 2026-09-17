import { defineEventHandler, getRouterParam } from 'h3'
import { appointmentDetails } from '@nuxt-customer-portal/planning/server/utils/management'

export default defineEventHandler(async (event) => {
  return appointmentDetails(event, getRouterParam(event, 'id')!)
})
