import { defineEventHandler } from 'h3'
import { getPolicy } from '@nuxt-customer-portal/planning/server/utils/management'

export default defineEventHandler(async (event) => {
  return getPolicy(event)
})
