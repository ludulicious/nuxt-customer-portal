import { admin } from '@nuxt-customer-portal/products/server/utils/access'
import { rows } from '@nuxt-customer-portal/products/server/utils/database'
import { environmentStripeManaged } from '@nuxt-customer-portal/products/server/utils/stripe-configuration'

export default defineEventHandler(async (event) => {
  const context = await admin(event)
  if (environmentStripeManaged()) {
    throw createError({ statusCode: 409, message: 'Stripe is managed by the deployment environment' })
  }
  await rows(
    `UPDATE products.store SET stripe_secret_key=NULL,stripe_webhook_secret=NULL,stripe_tested_at=NULL,actor_id=$2
     WHERE id=true AND organization_id=$1`,
    [context.organizationId, context.session.user.id]
  )
  return { configured: false }
})
