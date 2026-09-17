import { z } from 'zod'
import { admin } from '@nuxt-customer-portal/products/server/utils/access'
import { rows } from '@nuxt-customer-portal/products/server/utils/database'
import {
  decryptStripeSecret,
  encryptStripeSecret,
  environmentStripeManaged,
  testStripeSecretKey
} from '@nuxt-customer-portal/products/server/utils/stripe-configuration'

const schema = z.object({
  secretKey: z.string().trim().optional(),
  webhookSecret: z.string().trim().optional()
})

export default defineEventHandler(async (event) => {
  const context = await admin(event)
  if (environmentStripeManaged()) {
    throw createError({ statusCode: 409, message: 'Stripe is managed by the deployment environment' })
  }
  const input = schema.parse(await readBody(event))
  const [existing] = await rows<{ stripe_secret_key: string | null; stripe_webhook_secret: string | null }>(
    'SELECT stripe_secret_key,stripe_webhook_secret FROM products.store WHERE id=true AND organization_id=$1',
    [context.organizationId]
  )
  const secretKey =
    input.secretKey || (existing?.stripe_secret_key ? decryptStripeSecret(existing.stripe_secret_key) : '')
  const webhookSecret =
    input.webhookSecret || (existing?.stripe_webhook_secret ? decryptStripeSecret(existing.stripe_webhook_secret) : '')
  if (!secretKey.startsWith('sk_')) {
    throw createError({ statusCode: 422, message: 'Enter a valid Stripe secret key' })
  }
  if (!webhookSecret.startsWith('whsec_')) {
    throw createError({ statusCode: 422, message: 'Enter a valid Stripe webhook signing secret' })
  }
  try {
    await testStripeSecretKey(secretKey)
  } catch {
    throw createError({ statusCode: 422, message: 'Stripe rejected the secret key' })
  }
  await rows(
    `UPDATE products.store SET stripe_secret_key=$2,stripe_webhook_secret=$3,stripe_tested_at=now(),actor_id=$4
     WHERE id=true AND organization_id=$1`,
    [
      context.organizationId,
      encryptStripeSecret(secretKey),
      encryptStripeSecret(webhookSecret),
      context.session.user.id
    ]
  )
  return { configured: true }
})
