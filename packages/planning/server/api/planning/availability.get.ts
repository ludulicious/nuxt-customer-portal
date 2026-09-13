import { defineEventHandler } from 'h3'
import { windows } from '@nuxt-customer-portal/planning/server/utils/management'

export default defineEventHandler(async (event) => {
  return windows(event)
})
