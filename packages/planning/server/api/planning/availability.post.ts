import { defineEventHandler, readBody } from 'h3'
import { saveWindow } from '@nuxt-customer-portal/planning/server/utils/management'
import { sameOrigin } from '@nuxt-customer-portal/planning/server/utils/access'

export default defineEventHandler(async (event) => {
  sameOrigin(event)
  return saveWindow(event, await readBody(event))
})
