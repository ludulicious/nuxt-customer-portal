import { defineEventHandler } from 'h3'
import { planningAdmin } from '@nuxt-customer-portal/planning/server/utils/access'
import { rows } from '@nuxt-customer-portal/products/server/utils/database'

export default defineEventHandler(async (event) => {
  await planningAdmin(event)
  return rows(
    'SELECT id,kind,attempts,error FROM planning.job WHERE completed_at IS NULL ORDER BY available_at LIMIT 100'
  )
})
