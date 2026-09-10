import { parseInput } from '@nuxt-customer-portal/products/server/utils/validation'
import { admin, hash, newKey } from '@nuxt-customer-portal/products/server/utils/access'
import { randomUUID } from 'node:crypto'
import { rows } from '@nuxt-customer-portal/products/server/utils/database'
import { keySchema } from '@nuxt-customer-portal/products/shared/validation'

export default defineEventHandler(async (event) => {
  const { organizationId } = await admin(event),
    input = parseInput(keySchema, await readBody(event))
  if (input.expiresAt && new Date(input.expiresAt) <= new Date()) {
    throw createError({ statusCode: 400, message: 'Expiry must be in the future' })
  }
  const key = newKey(),
    id = randomUUID()
  await rows('INSERT INTO products.api_key(id,store_id,name,hash,prefix,expires_at) VALUES($1,$2,$3,$4,$5,$6)', [
    id,
    organizationId,
    input.name,
    hash(key),
    key.slice(0, 12),
    input.expiresAt
  ])
  setHeader(event, 'Cache-Control', 'no-store')
  return { id, key }
})
