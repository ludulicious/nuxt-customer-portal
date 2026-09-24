import portal from './portal.config'

const allowedHosts = (process.env.VITE_ALLOWED_HOSTS || '')
  .split(',')
  .map((host) => host.trim())
  .filter(Boolean)

export default defineNuxtConfig({
  extends: portal.nuxtLayers,
  modules: ['@nuxt/eslint', '@nuxt/ui', '@vueuse/nuxt', '@nuxtjs/i18n', '@pinia/nuxt'],
  ssr: false,
  css: ['~/assets/css/main.css'],
  runtimeConfig: {
    portalEmail: { brandingSource: 'portal-settings' },
    public: { clients: portal.clients, portalAuth: { termsUrl: '/terms' } }
  },
  // Nginx runs in Docker and reaches the local dev server through host.docker.internal.
  devServer: { host: '0.0.0.0', port: 3052 },
  compatibilityDate: '2025-10-24',
  nitro: {
    experimental: { openAPI: true },
    openAPI: {
      production: 'runtime',
      meta: { title: 'SaaS Portal API', version: '1.0.0' },
      route: '/api-docs/openapi.raw.json',
      ui: {
        scalar: {
          route: '/api-docs',
          theme: 'default',
          hideClientButton: true,
          spec: {
            url: '/api-docs/openapi.json'
          }
        },
        swagger: {
          route: '/api-docs/swagger'
        }
      }
    }
  },
  vite: { server: { allowedHosts } },
  eslint: { config: { stylistic: { commaDangle: 'never', braceStyle: '1tbs' } } },
  fonts: {
    families: [
      { name: 'Bricolage Grotesque', provider: 'google', weights: [400, 700, 800, 900], global: true },
      { name: 'Geist', provider: 'google', weights: [400, 600, 700], global: true },
      { name: 'Playfair Display', provider: 'google', weights: [400, 600, 700], global: true },
      { name: 'Lato', provider: 'google', weights: [300, 400, 700], global: true }
    ]
  },
  i18n: {
    locales: [
      { code: 'en', iso: 'en-US', name: 'English', file: 'en.json' },
      { code: 'nl', iso: 'nl-NL', name: 'Nederlands', file: 'nl.json' }
    ],
    defaultLocale: 'en',
    strategy: 'no_prefix',
    detectBrowserLanguage: {
      useCookie: true,
      cookieKey: 'i18n_redirected',
      redirectOn: 'root',
      alwaysRedirect: false,
      fallbackLocale: 'en'
    }
  }
})
