import { fileURLToPath } from 'node:url'

export default defineNuxtConfig({
  $meta: { name: 'nuxt-customer-portal-ui' },
  compatibilityDate: '2025-10-24',
  modules: ['@nuxt/ui', '@nuxtjs/i18n', '@pinia/nuxt'],
  css: [fileURLToPath(new URL('./app/assets/css/surfaces.css', import.meta.url))],
  i18n: {
    locales: [
      { code: 'en', file: 'en.json' },
      { code: 'nl', file: 'nl.json' }
    ]
  }
})
