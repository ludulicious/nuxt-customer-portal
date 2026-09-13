import { defineEventHandler, getRouterParam } from 'h3'
import { planningAdmin } from '@nuxt-customer-portal/planning/server/utils/access'
import { rows } from '@nuxt-customer-portal/products/server/utils/database'

export default defineEventHandler(async (event) => {
  const context = await planningAdmin(event)
  return rows(
    'SELECT x.action,x.data,x.created_at,u.name AS actor FROM planning.audit x JOIN planning.appointment a ON a.id=x.appointment_id LEFT JOIN public."user" u ON u.id=x.actor_id WHERE a.store_id=$1 AND a.id::text=$2 ORDER BY x.created_at',
    [context.organizationId, getRouterParam(event, 'id')]
  )
})
