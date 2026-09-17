import { defineEventHandler, readBody } from 'h3'
import { releaseHold } from '../../../utils/booking'
import { sameOrigin } from '../../../utils/access'
import { publicLimit } from '@nuxt-customer-portal/products/server/utils/access'

export default defineEventHandler(async (event) => {
  await publicLimit(event)
  sameOrigin(event)
  await releaseHold(event, await readBody(event))
  return { released: true }
})
