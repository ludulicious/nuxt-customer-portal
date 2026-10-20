import { parseInput } from '@nuxt-customer-portal/products/server/utils/validation'
import { admin } from '@nuxt-customer-portal/products/server/utils/access'
import { rows, transaction } from '@nuxt-customer-portal/products/server/utils/database'
import { validateOutstandingOffers } from '@nuxt-customer-portal/products/server/utils/offers'
import type { Price, ProductData } from '@nuxt-customer-portal/products/shared/types'
import { randomUUID } from 'node:crypto'
import { settingsSchema } from '@nuxt-customer-portal/products/shared/validation'
import { orderIntegration } from '@nuxt-customer-portal/products/server/utils/contracts'
import { stripeClient } from '@nuxt-customer-portal/products/server/utils/payments'
import { storage } from '@nuxt-customer-portal/products/server/utils/storage'
import { getPortalEmailProviderStatus } from '@nuxt-customer-portal/core/server/utils/portal-email'
import { getClientConfiguration } from '@nuxt-customer-portal/clients/server/utils/client-configuration'
import { stripeSummary } from '@nuxt-customer-portal/products/server/utils/stripe-configuration'

export default defineEventHandler(async (event) => {
  const context = await admin(event),
    input = parseInput(settingsSchema, await readBody(event))
  if (input.invoicePayment) {
    await orderIntegration().assertReady(context.organizationId)
  }
  if (input.enabled && !input.onlinePayment && !input.invoicePayment) {
    throw createError({ statusCode: 400, message: 'Enable at least one payment method' })
  }
  if (input.enabled && input.mode === 'live') {
    if (input.onlinePayment) {
      await stripeClient()
    }
    await storage()
    if (input.onlinePayment && !(await stripeSummary()).webhookConfigured) {
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
    await tx.query('SELECT id FROM products.store WHERE organization_id=$1 FOR UPDATE', [context.organizationId])
    const products = await rows<{ id: string; data: ProductData }>(
      'SELECT id,data FROM products.product WHERE store_id=$1 ORDER BY id',
      [context.organizationId],
      tx
    )
    for (const product of products) {
      const prices = await rows<Price>(
        'SELECT currency,amount FROM products.price WHERE product_id=$1 AND active AND offer_id IS NULL',
        [product.id],
        tx
      )
      await validateOutstandingOffers(product.id, { ...product.data, prices }, input.currencies, tx)
    }
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
    await tx.query('UPDATE products.store SET online_payment=$2,invoice_payment=$3 WHERE organization_id=$1', [
      context.organizationId,
      input.onlinePayment,
      input.invoicePayment
    ])
    for (const [currency, taxBehavior] of Object.entries(currencyTaxBehavior)) {
      const changed = await rows<{ product_id: string; amount: number; offer_id: string | null }>(
        `UPDATE products.price pr SET active=false FROM products.product p WHERE p.id=pr.product_id AND p.store_id=$1 AND pr.active AND pr.currency=$2 AND pr.tax_behavior<>$3 RETURNING pr.product_id,pr.amount,pr.offer_id`,
        [context.organizationId, currency, taxBehavior],
        tx
      )
      for (const price of changed) {
        await tx.query(
          'INSERT INTO products.price(id,product_id,currency,amount,tax_behavior,offer_id) VALUES($1,$2,$3,$4,$5,$6)',
          [randomUUID(), price.product_id, currency, price.amount, taxBehavior, price.offer_id]
        )
      }
    }
  })
  return input
})
