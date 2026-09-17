import { defineEventHandler } from 'h3'
import { ownSettings } from '@nuxt-customer-portal/planning/server/utils/management'

export default defineEventHandler(async (event) => {
  return ownSettings(event)
})
