export default defineNuxtConfig({
  $meta: { name: 'nuxt-customer-portal-authentication' },
  compatibilityDate: '2025-10-24',
  modules: ['@nuxtjs/i18n'],
  icon: {
    clientBundle: {
      icons: ['lucide:lock', 'simple-icons:github', 'simple-icons:google']
    }
  },
  i18n: { locales: [{ code: 'en', file: 'en.json' }, { code: 'nl', file: 'nl.json' }] }
})
