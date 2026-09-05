import { fileURLToPath } from 'node:url'

export default defineNuxtConfig({
  $meta: { name: 'nuxt-customer-portal-saas-configuration' },
  modules: ['@nuxtjs/i18n'],
  css: [fileURLToPath(new URL('./app/assets/css/main.css', import.meta.url))],
  i18n: {
    defaultLocale: 'en',
    strategy: 'no_prefix',
    locales: [
      { code: 'en', file: 'en.json' },
      { code: 'nl', file: 'nl.json' }
    ]
  }
})
