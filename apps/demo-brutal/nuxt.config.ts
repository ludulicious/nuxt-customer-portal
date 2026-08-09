import portal from './portal.config'

export default defineNuxtConfig({
  extends: portal.nuxtLayers,
  ssr: false,
  compatibilityDate: '2025-10-24',
  modules: ['@nuxt/eslint', '@nuxt/ui', '@vueuse/nuxt', '@nuxtjs/i18n', '@pinia/nuxt'],
  css: ['~/assets/css/main.css'],
  fonts: {
    families: [
      { name: 'Bricolage Grotesque', provider: 'google', weights: [700, 800], global: true },
      { name: 'Geist', provider: 'google', weights: [400, 600, 700], global: true }
    ]
  },
  devtools: { enabled: true },
  i18n: {
    locales: [{ code: 'en', iso: 'en-US', name: 'English', file: 'en.json' }, { code: 'nl', iso: 'nl-NL', name: 'Nederlands', file: 'nl.json' }],
    defaultLocale: 'en', strategy: 'no_prefix', langDir: 'locales'
  },
  runtimeConfig: { portalEmail: { brandName: 'Brutal Works' }, public: { portalAuth: { termsUrl: '/' } } }
})
