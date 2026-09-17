import { fileURLToPath } from 'node:url'

export default defineNuxtConfig({
  $meta: { name: 'nuxt-customer-portal-planning' },
  compatibilityDate: '2025-10-24',
  modules: ['@nuxtjs/i18n'],
  components: [{ path: fileURLToPath(new URL('./app/components', import.meta.url)), global: true }],
  nitro: { experimental: { tasks: true }, scheduledTasks: { '* * * * *': ['planning:reconcile'] } },
  i18n: {
    locales: [
      { code: 'en', file: 'en.json' },
      { code: 'nl', file: 'nl.json' }
    ]
  }
})
