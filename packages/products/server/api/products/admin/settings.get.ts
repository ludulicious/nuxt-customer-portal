import { markdownStyleSchema } from '@nuxt-customer-portal/products/shared/markdown-style'
import { admin } from '@nuxt-customer-portal/products/server/utils/access'
import { rows } from '@nuxt-customer-portal/products/server/utils/database'
import { storageSummary } from '@nuxt-customer-portal/products/server/utils/storage-configuration'
import { checkoutAppearanceSchema } from '@nuxt-customer-portal/products/shared/checkout-appearance'
import { stripeSummary } from '@nuxt-customer-portal/products/server/utils/stripe-configuration'

export default defineEventHandler(async (event) => {
  await admin(event)
  const [store] = await rows(
    'SELECT markdown_style,checkout_appearance AS "checkoutAppearance",image_policy,currency_tax_behavior AS "currencyTaxBehavior",languages,currencies,enabled,mode,default_locale AS "defaultLocale" FROM products.store WHERE id=true'
  )
  const storage = await storageSummary()
  const stripe = await stripeSummary()
  return {
    checkoutAppearance: checkoutAppearanceSchema.parse(store?.checkoutAppearance || {}),
    markdownStyle: markdownStyleSchema.parse(store?.markdown_style || {}),
    enabled: store?.enabled || false,
    mode: store?.mode || 'sandbox',
    languages: store?.languages || ['en', 'nl'],
    currencyTaxBehavior: store?.currencyTaxBehavior || {},
    currencies: store?.currencies || ['EUR'],
    defaultLocale: store?.defaultLocale || 'en',
    imagePolicy: store?.image_policy || {
      thumbnail: { width: 400, height: 400 },
      gallery: { width: 800, height: 1000 },
      detail: { width: 1200, height: 900 }
    },
    stripeConfigured: stripe.configured,
    webhookConfigured: stripe.webhookConfigured,
    stripe,
    storageConfigured: storage.configured,
    storage
  }
})
