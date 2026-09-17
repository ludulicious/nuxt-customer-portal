import { defineEventHandler, getQuery, getRouterParam } from 'h3'
import { deleteWindow } from '@nuxt-customer-portal/planning/server/utils/management'
import { sameOrigin } from '@nuxt-customer-portal/planning/server/utils/access'

export default defineEventHandler(async (event) => {
  sameOrigin(event)
  return deleteWindow(
    event,
    getRouterParam(event, 'id')!,
    typeof getQuery(event).occurrence === 'string' ? String(getQuery(event).occurrence) : undefined
  )
})
