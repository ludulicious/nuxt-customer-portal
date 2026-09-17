import { z } from 'zod'
import { admin } from '@nuxt-customer-portal/products/server/utils/access'
import { rows } from '@nuxt-customer-portal/products/server/utils/database'
import {
  decryptStripeSecret,
  environmentStripeManaged,
  testStripeSecretKey
} from '@nuxt-customer-portal/products/server/utils/stripe-configuration'

const schema = z.object({
  secretKey: z.string().trim().optional()
})

export default defineEventHandler(async (event) => {
  const context = await admin(event)
  if (environmentStripeManaged()) {
    throw createError({ statusCode: 409, message: 'Stripe is managed by the deployment environment' })
  }

  const input = schema.parse(await readBody(event))
  const [existing] = await rows<{ stripe_secret_key: string | null }>(
    'SELECT stripe_secret_key FROM products.store WHERE id=true AND organization_id=$1',
    [context.organizationId]
  )
  const secretKey =
    input.secretKey || (existing?.stripe_secret_key ? decryptStripeSecret(existing.stripe_secret_key) : '')
  if (!secretKey.startsWith('sk_')) {
    throw createError({ statusCode: 422, message: 'Enter a valid Stripe secret key' })
  }

  try {
    const account = await testStripeSecretKey(secretKey)
    return { accountId: account.id, livemode: !secretKey.startsWith('sk_test_') }
  } catch {
    throw createError({ statusCode: 422, message: 'Stripe rejected the secret key' })
  }
})
