// https://nuxt.com/docs/api/configuration/nuxt-config
import portal from './portal.config'

export default defineNuxtConfig({
  extends: portal.nuxtLayers,
  ssr: false,
  modules: [
    '@nuxt/eslint',
    '@nuxt/image',
    '@nuxt/ui',
    '@nuxt/content',
    '@vueuse/nuxt',
    '@nuxtjs/i18n',
    '@pinia/nuxt'
  ],
  image: {
    quality: 80,
    format: ['webp', 'avif', 'jpeg'],
    screens: {
      xs: 320,
      sm: 640,
      md: 768,
      lg: 1024,
      xl: 1280,
      xxl: 1536,
    },
    densities: [1, 2],
    presets: {
      avatar: {
        modifiers: {
          format: 'webp',
          width: 150,
          height: 150,
          quality: 80
        }
      },
      hero: {
        modifiers: {
          format: 'webp',
          width: 1200,
          height: 600,
          quality: 85
        }
      },
      thumbnail: {
        modifiers: {
          format: 'webp',
          width: 400,
          height: 300,
          quality: 75
        }
      }
    }
  },
  devtools: {
    enabled: true,
    timeline: {
      enabled: false
    }
  },
  devServer: {
    port: 3051,
  },
  css: ['~/assets/css/main.css'],

  fonts: {
    families: [
      {
        name: 'Bricolage Grotesque',
        provider: 'google',
        weights: [400, 700, 800, 900],
        global: true
      },
      {
        name: 'Geist',
        provider: 'google',
        weights: [400, 700],
        global: true
      }
    ]
  },

  compatibilityDate: '2025-10-24',

  runtimeConfig: { public: { clients: portal.clients } },

  nitro: {
    experimental: {
      openAPI: true
    },
    openAPI: {
      production: 'runtime',
      meta: {
        title: 'ApexPro API',
        description: 'Interactive API documentation for the ApexPro customer portal. Requests are made using your current authenticated session and permissions.',
        version: '1.0.0'
      },
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
    },
    routeRules: {
      '/': { swr: 300 },
      '/blog/**': { swr: 600 }
    },
    prerender: {
      routes: ['/', '/contact'],
      crawlLinks: false,
      failOnError: false
    }
  },

  eslint: {
    config: {
      stylistic: {
        commaDangle: 'never',
        braceStyle: '1tbs'
      }
    }
  },

  content: {
    database: {
      type: 'sqlite',
      filename: '.data/content/contents.sqlite'
    }
  },

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
    ],
    defaultLocale: 'en',
    strategy: 'no_prefix',
    detectBrowserLanguage: {
      useCookie: true,
      cookieKey: 'i18n_redirected',
      redirectOn: 'root',
      alwaysRedirect: false,
      fallbackLocale: 'en'
    },
  }
})
