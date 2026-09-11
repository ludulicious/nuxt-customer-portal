import { parseInput } from '@nuxt-customer-portal/products/server/utils/validation'
import { admin } from '@nuxt-customer-portal/products/server/utils/access'
import { rows } from '@nuxt-customer-portal/products/server/utils/database'
import { settingsSchema } from '@nuxt-customer-portal/products/shared/validation'
import { purchaseIntegration } from '@nuxt-customer-portal/products/server/utils/contracts'
import { stripeClient } from '@nuxt-customer-portal/products/server/utils/payments'
import { storage } from '@nuxt-customer-portal/products/server/utils/storage'
import { getPortalEmailProviderStatus } from '@nuxt-customer-portal/core/server/utils/portal-email'
import { getClientConfiguration } from '@nuxt-customer-portal/clients/server/utils/client-configuration'

export default defineEventHandler(async (event) => {
  const context = await admin(event),
    input = parseInput(settingsSchema, await readBody(event))
  if (input.enabled) {
    stripeClient()
    storage()
    if (!process.env.PRODUCTS_STRIPE_WEBHOOK_SECRET) {
      throw createError({ statusCode: 409, message: 'Configure Stripe webhooks' })
    }
    await purchaseIntegration().assertReady(context.organizationId)
    const config = await getClientConfiguration()
    if (!['person', 'organization'].every((t) => config.allowedTypes.includes(t as 'person' | 'organization'))) {
      throw createError({ statusCode: 409, message: 'Enable personal and business clients first' })
    }
    if (!(await getPortalEmailProviderStatus()).configured) {
      throw createError({ statusCode: 409, message: 'Configure email delivery first' })
    }
  }
  await rows(
    `INSERT INTO products.store(id,organization_id,actor_id,enabled,default_locale,currencies) VALUES(true,$1,$2,$3,$4,$5) ON CONFLICT(id) DO UPDATE SET enabled=$3,default_locale=$4,actor_id=$2,currencies=$5 WHERE products.store.organization_id=$1`,
    [context.organizationId, context.session.user.id, input.enabled, input.defaultLocale, input.currencies]
  )
  return input
})
