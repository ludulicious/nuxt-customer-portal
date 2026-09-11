import { admin } from '@nuxt-customer-portal/products/server/utils/access'
import { rows } from '@nuxt-customer-portal/products/server/utils/database'

export default defineEventHandler(async (event) => {
  await admin(event)
  const [store] = await rows(
    'SELECT languages,currencies,enabled,default_locale AS "defaultLocale" FROM products.store WHERE id=true'
  )
  return {
    enabled: store?.enabled || false,
    languages: store?.languages || ['en', 'nl'],
    currencies: store?.currencies || ['EUR'],
    defaultLocale: store?.defaultLocale || 'en',
    stripeConfigured: !!process.env.PRODUCTS_STRIPE_SECRET_KEY,
    webhookConfigured: !!process.env.PRODUCTS_STRIPE_WEBHOOK_SECRET,
    storageConfigured: !!process.env.PRODUCTS_S3_BUCKET
  }
})
