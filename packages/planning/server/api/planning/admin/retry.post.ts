import { defineEventHandler } from 'h3'
import { planningAdmin, sameOrigin } from '@nuxt-customer-portal/planning/server/utils/access'
import { rows } from '@nuxt-customer-portal/products/server/utils/database'
import { runJobs } from '@nuxt-customer-portal/planning/server/utils/jobs'
import { getStore } from '@nuxt-customer-portal/products/server/utils/access'

export default defineEventHandler(async (event) => {
  sameOrigin(event)
  await planningAdmin(event)
  const store = await getStore()
  await rows(
    `UPDATE planning.job j SET available_at=now() WHERE completed_at IS NULL AND COALESCE(
      j.payload->>'storeId',
      (SELECT a.store_id FROM planning.appointment a WHERE a.id::text=j.payload->>'appointmentId'),
      (SELECT w.store_id FROM planning.availability w WHERE w.id::text=j.payload->>'id'),
      (SELECT o.store_id FROM products.orders o WHERE o.id::text=j.payload->>'orderId')
    )=$1`,
    [store.organization_id]
  )
  let completed = 0,
    failed = 0
  for (let batch = 0; batch < 10; batch++) {
    const result = await runJobs(20, store.organization_id)
    completed += result.completed
    failed += result.failed
    if (result.completed + result.failed < 20) {
      break
    }
  }
  return { completed, failed }
})
