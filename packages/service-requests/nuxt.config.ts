export default defineNuxtConfig({
  $meta: { name: 'nuxt-customer-portal-service-requests' },
  compatibilityDate: '2025-10-24',
  modules: ['@nuxtjs/i18n'],
  i18n: {
    locales: [
      {
        code: 'en',
        iso: 'en-US',
        name: 'English',
        file: 'en.json'
      },
      {
        code: 'nl',
        iso: 'nl-NL',
        name: 'Nederlands',
        file: 'nl.json'
      }
    ]
  }
})
