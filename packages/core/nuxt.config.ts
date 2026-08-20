import { fileURLToPath } from 'node:url'

const envFlag = (value: string | undefined, fallback = true) => value === undefined ? fallback : value === 'true'
const registrationMode = ['open', 'invitation-only', 'disabled'].includes(process.env.PORTAL_REGISTRATION_MODE || '')
  ? process.env.PORTAL_REGISTRATION_MODE as 'open' | 'invitation-only' | 'disabled'
  : 'open'

export default defineNuxtConfig({
  $meta: { name: 'nuxt-customer-portal-core' },
  compatibilityDate: '2025-10-24',
  modules: ['@nuxtjs/i18n', '@vueuse/nuxt'],
  i18n: {
    defaultLocale: 'en',
    strategy: 'no_prefix',
    locales: [{ code: 'en', file: 'en.json' }, { code: 'nl', file: 'nl.json' }]
  },
  runtimeConfig: {
    portalEmail: {
      templateStorage: 'assets:portal-core',
      brandName: 'Nuxt Customer Portal'
    },
    portalAuth: {
      registrationMode,
      githubEnabled: envFlag(process.env.PORTAL_GITHUB_ENABLED),
      googleEnabled: envFlag(process.env.PORTAL_GOOGLE_ENABLED)
    },
    public: {
      portalAuth: {
        registrationMode,
        githubEnabled: envFlag(process.env.PORTAL_GITHUB_ENABLED),
        googleEnabled: envFlag(process.env.PORTAL_GOOGLE_ENABLED),
        termsUrl: process.env.PORTAL_TERMS_URL || '/terms-of-service'
      }
    }
  },
  nitro: {
    serverAssets: [{
      baseName: 'portal-core',
      dir: fileURLToPath(new URL('./server/utils', import.meta.url))
    }]
  }
})
