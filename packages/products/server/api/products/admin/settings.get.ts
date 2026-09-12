import { markdownStyleSchema } from '@nuxt-customer-portal/products/shared/markdown-style'
import { admin } from '@nuxt-customer-portal/products/server/utils/access'
import { rows } from '@nuxt-customer-portal/products/server/utils/database'
import { storageSummary } from '@nuxt-customer-portal/products/server/utils/storage-configuration'

export default defineEventHandler(async (event) => {
  await admin(event)
  const [store] = await rows(
    'SELECT markdown_style,image_policy,currency_tax_behavior AS "currencyTaxBehavior",languages,currencies,enabled,mode,default_locale AS "defaultLocale" FROM products.store WHERE id=true'
  )
  const storage = await storageSummary()
  return {
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
    stripeConfigured: !!process.env.PRODUCTS_STRIPE_SECRET_KEY,
    webhookConfigured: !!process.env.PRODUCTS_STRIPE_WEBHOOK_SECRET,
    storageConfigured: storage.configured,
    storage
  }
})
