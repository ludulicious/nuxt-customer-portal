import { fileURLToPath } from 'node:url'

export default defineNuxtConfig({
  $meta: { name: 'nuxt-customer-portal-products' },
  compatibilityDate: '2025-10-24',
  modules: ['@nuxtjs/i18n'],
  nitro: { experimental: { tasks: true }, scheduledTasks: { '* * * * *': ['products:reconcile'] } },
  components: [{ path: fileURLToPath(new URL('./app/components', import.meta.url)), global: true }],
  i18n: {
    locales: [
      { code: 'en', file: 'en.json' },
      { code: 'nl', file: 'nl.json' }
    ]
  }
})
