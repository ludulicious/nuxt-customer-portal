import { parseInput } from '@nuxt-customer-portal/products/server/utils/validation'
import { admin } from '@nuxt-customer-portal/products/server/utils/access'
import { rows, transaction } from '@nuxt-customer-portal/products/server/utils/database'
import { randomUUID } from 'node:crypto'
import { settingsSchema } from '@nuxt-customer-portal/products/shared/validation'
import { orderIntegration } from '@nuxt-customer-portal/products/server/utils/contracts'
import { stripeClient } from '@nuxt-customer-portal/products/server/utils/payments'
import { storage } from '@nuxt-customer-portal/products/server/utils/storage'
import { getPortalEmailProviderStatus } from '@nuxt-customer-portal/core/server/utils/portal-email'
import { getClientConfiguration } from '@nuxt-customer-portal/clients/server/utils/client-configuration'

export default defineEventHandler(async (event) => {
  const context = await admin(event),
    input = parseInput(settingsSchema, await readBody(event))
  if (input.enabled && input.mode === 'live') {
    stripeClient()
    await storage()
    if (!process.env.PRODUCTS_STRIPE_WEBHOOK_SECRET) {
      throw createError({ statusCode: 409, message: 'Configure Stripe webhooks' })
    }
    await orderIntegration().assertReady(context.organizationId)
    const config = await getClientConfiguration()
    if (!['person', 'organization'].every((t) => config.allowedTypes.includes(t as 'person' | 'organization'))) {
      throw createError({ statusCode: 409, message: 'Enable personal and business clients first' })
    }
    if (!(await getPortalEmailProviderStatus()).configured) {
      throw createError({ statusCode: 409, message: 'Configure email delivery first' })
    }
  }
  await transaction(async (tx) => {
    const currencyTaxBehavior = Object.fromEntries(
      input.currencies.map((currency) => [currency, input.currencyTaxBehavior[currency] || 'inclusive'])
    )
    await rows(
      `INSERT INTO products.store(id,organization_id,actor_id,enabled,mode,default_locale,currencies,languages,currency_tax_behavior,markdown_style,image_policy,checkout_appearance) VALUES(true,$1,$2,$3,$4,$5,$6,$7,$8,COALESCE($9::jsonb,'{}'::jsonb),$10,$11) ON CONFLICT(id) DO UPDATE SET enabled=$3,mode=$4,default_locale=$5,actor_id=$2,currencies=$6,languages=$7,currency_tax_behavior=$8,markdown_style=COALESCE($9::jsonb,products.store.markdown_style),image_policy=$10,checkout_appearance=$11 WHERE products.store.organization_id=$1`,
      [
        context.organizationId,
        context.session.user.id,
        input.enabled,
        input.mode,
        input.defaultLocale,
        input.currencies,
        input.languages,
        currencyTaxBehavior,
        input.markdownStyle || null,
        input.imagePolicy,
        input.checkoutAppearance
      ],
      tx
    )
    for (const [currency, taxBehavior] of Object.entries(currencyTaxBehavior)) {
      const changed = await rows<{ product_id: string; amount: number }>(
        `UPDATE products.price pr SET active=false FROM products.product p WHERE p.id=pr.product_id AND p.store_id=$1 AND pr.active AND pr.currency=$2 AND pr.tax_behavior<>$3 RETURNING pr.product_id,pr.amount`,
        [context.organizationId, currency, taxBehavior],
        tx
      )
      for (const price of changed) {
        await tx.query(
          'INSERT INTO products.price(id,product_id,currency,amount,tax_behavior) VALUES($1,$2,$3,$4,$5)',
          [randomUUID(), price.product_id, currency, price.amount, taxBehavior]
        )
      }
    }
  })
  return input
})
