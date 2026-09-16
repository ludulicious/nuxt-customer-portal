import { createError, defineEventHandler, getRouterParam } from 'h3'
import { z } from 'zod'
import { planningAdmin, sameOrigin } from '@nuxt-customer-portal/planning/server/utils/access'
import { getStore } from '@nuxt-customer-portal/products/server/utils/access'
import { rows } from '@nuxt-customer-portal/products/server/utils/database'
import { runJobs } from '@nuxt-customer-portal/planning/server/utils/jobs'

export default defineEventHandler(async (event) => {
  sameOrigin(event)
  await planningAdmin(event)
  const store = await getStore()
  const id = z.string().min(1).max(500).parse(getRouterParam(event, 'id'))
  const updated = await rows<{ id: string }>(
    `UPDATE planning.job j SET available_at=now() WHERE id=$1 AND completed_at IS NULL AND COALESCE(
      j.payload->>'storeId',
      (SELECT a.store_id FROM planning.appointment a WHERE a.id::text=j.payload->>'appointmentId'),
      (SELECT w.store_id FROM planning.availability w WHERE w.id::text=j.payload->>'id'),
      (SELECT o.store_id FROM products.orders o WHERE o.id::text=j.payload->>'orderId')
    )=$2 RETURNING id`,
    [id, store.organization_id]
  )
  if (!updated.length) {
    throw createError({ statusCode: 404, message: 'Synchronization task not found' })
  }
  return runJobs(1, store.organization_id, id)
})
