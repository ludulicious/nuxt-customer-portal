import portal from './portal.config'

export default defineNuxtConfig({
  extends: portal.nuxtLayers,
  ssr: true,
  compatibilityDate: '2025-10-24',
  devServer: {
    port: 3053
  },
  css: ['~/assets/css/main.css'],
  modules: ['@nuxt/eslint', '@nuxt/ui', '@vueuse/nuxt', '@nuxtjs/i18n', '@pinia/nuxt'],
  runtimeConfig: {
    public: {
      platformHost: process.env.SAAS_PLATFORM_HOST || 'platform.localhost',
      platformDomain: process.env.SAAS_PLATFORM_DOMAIN || 'platform.localhost',
      clients: portal.clients
    }
  },
  i18n: {
    locales: [{ code: 'en', file: 'en.json' }, { code: 'nl', file: 'nl.json' }],
    defaultLocale: 'en',
    strategy: 'no_prefix'
  },
  nitro: {
    experimental: { openAPI: true }
  }
})
