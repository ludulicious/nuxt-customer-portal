import { fileURLToPath } from 'node:url'

export default defineNuxtConfig({
  $meta: { name: 'nuxt-customer-portal-products' },
  compatibilityDate: '2025-10-24',
  modules: ['@nuxtjs/i18n', '@nuxt/image'],
  css: [fileURLToPath(new URL('./app/assets/css/media.css', import.meta.url))],
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
  routeRules: {
    '/api/products/media/**': { headers: { 'Cache-Control': 'private, no-store', Vary: 'Authorization, Cookie' } },
    '/store/orders/**': {
      headers: {
        'Cache-Control': 'private, no-store',
        'Referrer-Policy': 'no-referrer',
        'X-Robots-Tag': 'noindex, nofollow, noarchive'
      }
    }
  },
  runtimeConfig: { public: { productsImageKitUrlEndpoint: process.env.PRODUCTS_IMAGEKIT_URL_ENDPOINT || '' } },
  nitro: {
    experimental: { tasks: true },
    scheduledTasks: { '* * * * *': ['products:reconcile'] },
    hooks: {
      'types:extend': (types) => {
        // This dispatcher mixes binary and JSON responses; its public contracts
        // are explicitly typed in shared/media.ts and useStoreMedia. Excluding
        // unknown catchall responses keeps the host's route inference bounded.
        types.routes = Object.fromEntries(
          Object.entries(types.routes).filter(
            ([path]) => path !== '/api/products/media' && !path.startsWith('/api/products/media/')
          )
        )
      }
    }
  },
  components: [{ path: fileURLToPath(new URL('./app/components', import.meta.url)), global: true }],
  i18n: {
    locales: [
      { code: 'en', file: 'en.json' },
      { code: 'nl', file: 'nl.json' }
    ]
  }
})
