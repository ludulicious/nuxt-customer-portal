import { defineEventHandler } from 'h3'
import { providerAccess } from '@nuxt-customer-portal/planning/server/utils/access'
import { calendarAdapter } from '@nuxt-customer-portal/planning/server/utils/adapters'

export default defineEventHandler(async (event) => {
  const { storeId, userId } = await providerAccess(event)
  return calendarAdapter().calendars(storeId, userId)
})
