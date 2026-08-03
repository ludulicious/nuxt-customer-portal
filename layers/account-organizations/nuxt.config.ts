export default defineNuxtConfig({
  compatibilityDate: '2025-10-24',
  modules: ['@nuxtjs/i18n'],
  i18n: { locales: [{ code: 'en', file: 'en.json' }, { code: 'nl', file: 'nl.json' }] }
})
