import { fileURLToPath } from 'node:url'

export default defineNuxtConfig({
  $meta: { name: 'nuxt-customer-portal-invoices' },
  compatibilityDate: '2025-10-24',
  modules: ['@nuxtjs/i18n'],
  css: [fileURLToPath(new URL('./app/assets/invoices.css', import.meta.url))],
  components: [{ path: fileURLToPath(new URL('./app/components', import.meta.url)), global: true }],
  i18n: {
    locales: [
      { code: 'en', iso: 'en-US', name: 'English', file: 'en.json' },
      { code: 'nl', iso: 'nl-NL', name: 'Nederlands', file: 'nl.json' }
    ]
  }
})
