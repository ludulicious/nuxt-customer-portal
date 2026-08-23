export default defineNuxtConfig({
  $meta: { name: 'nuxt-customer-portal-saas-configuration' },
  modules: ['@nuxtjs/i18n'],
  i18n: {
    defaultLocale: 'en',
    strategy: 'no_prefix',
    locales: [{ code: 'en', file: 'en.json' }, { code: 'nl', file: 'nl.json' }]
  }
})
