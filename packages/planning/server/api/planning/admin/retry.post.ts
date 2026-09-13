import { defineEventHandler } from 'h3'
import { planningAdmin, sameOrigin } from '@nuxt-customer-portal/planning/server/utils/access'
import { rows } from '@nuxt-customer-portal/products/server/utils/database'
import { runJobs } from '@nuxt-customer-portal/planning/server/utils/jobs'

export default defineEventHandler(async (event) => {
  sameOrigin(event)
  await planningAdmin(event)
  await rows('UPDATE planning.job SET available_at=now() WHERE completed_at IS NULL')
  return runJobs()
})
