import portal from './portal.config'

export default defineNuxtConfig({
  extends: portal.nuxtLayers,
  ssr: true,
  compatibilityDate: '2025-10-24',
  devServer: {
    host: 'platform.localhost',
    port: 3053
  },
  css: ['~/assets/css/main.css'],
  modules: ['@nuxt/eslint', '@nuxt/ui', '@vueuse/nuxt', '@nuxtjs/i18n', '@pinia/nuxt'],
  icon: {
    clientBundle: {
      icons: [
        'lucide:arrow-down', 'lucide:arrow-up', 'lucide:building-2', 'lucide:check',
        'lucide:chevron-down', 'lucide:chevron-right', 'lucide:clock-3', 'lucide:edit',
        'lucide:circle', 'lucide:circle-check', 'lucide:filter', 'lucide:inbox', 'lucide:layout-dashboard', 'lucide:list-checks',
        'lucide:loader-2', 'lucide:loader-circle', 'lucide:menu', 'lucide:moon',
        'lucide:life-buoy', 'lucide:plus', 'lucide:plus-circle', 'lucide:receipt', 'lucide:refresh-cw', 'lucide:search',
        'lucide:search-x', 'lucide:settings', 'lucide:shield-check', 'lucide:ticket',
        'lucide:users', 'lucide:x', 'simple-icons:github', 'simple-icons:google'
      ]
    }
  },
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
