import { defineEventHandler } from 'h3'
import { listProviders } from '@nuxt-customer-portal/planning/server/utils/management'

export default defineEventHandler(async (event) => {
  return listProviders(event)
})
