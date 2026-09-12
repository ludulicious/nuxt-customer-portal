import { fileURLToPath } from 'node:url'

export default defineNuxtConfig({
  $meta: { name: 'nuxt-customer-portal-products' },
  compatibilityDate: '2025-10-24',
  modules: ['@nuxtjs/i18n', '@nuxt/image'],
  image: {
    quality: 85,
    format: ['avif', 'webp'],
    imagekit: { baseURL: process.env.PRODUCTS_IMAGEKIT_URL_ENDPOINT || '' },
    presets: {
      productThumbnail: { modifiers: { width: 240, quality: 80 } },
      productCard: { modifiers: { width: 640, quality: 85 } },
      productGallery: { modifiers: { quality: 88 } }
    }
  },
  runtimeConfig: { public: { productsImageKitUrlEndpoint: process.env.PRODUCTS_IMAGEKIT_URL_ENDPOINT || '' } },
  nitro: { experimental: { tasks: true }, scheduledTasks: { '* * * * *': ['products:reconcile'] } },
  components: [{ path: fileURLToPath(new URL('./app/components', import.meta.url)), global: true }],
  i18n: {
    locales: [
      { code: 'en', file: 'en.json' },
      { code: 'nl', file: 'nl.json' }
    ]
  }
})
