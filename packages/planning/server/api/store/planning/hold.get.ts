import { defineEventHandler, getQuery, setHeader, createError } from 'h3'
import { rows } from '@nuxt-customer-portal/products/server/utils/database'
import { publicLimit } from '@nuxt-customer-portal/products/server/utils/access'
import { parseInput } from '@nuxt-customer-portal/products/server/utils/validation'
import { holdHash } from '../../../utils/booking'
import { holdCredentialSchema } from '../../../../shared/validation'

export default defineEventHandler(async (event) => {
  await publicLimit(event)
  setHeader(event, 'Cache-Control', 'no-store')
  const input = parseInput(holdCredentialSchema, getQuery(event))
  const [hold] = await rows<{
    product_id: string
    start_at: Date
    end_at: Date
    expires_at: Date
    name: string
    snapshot: { unitAmount: number; currency: string; customerTimezone: string }
  }>(
    `SELECT r.*,u.name FROM planning.reservation r JOIN public."user" u ON u.id=r.user_id WHERE r.token_hash=$1 AND r.status='reserved' AND r.expires_at>now()`,
    [holdHash(event, input.holdToken)]
  )
  if (!hold) {
    throw createError({ statusCode: 409, message: 'Reservation expired' })
  }
  return {
    productId: hold.product_id,
    start: hold.start_at,
    end: hold.end_at,
    expiresAt: hold.expires_at,
    providerName: hold.name,
    amount: hold.snapshot.unitAmount,
    currency: hold.snapshot.currency,
    customerTimezone: hold.snapshot.customerTimezone
  }
})
