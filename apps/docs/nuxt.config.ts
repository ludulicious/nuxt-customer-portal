import { documentationDefaults } from './shared/documentation'

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  modules: [
    '@nuxt/eslint',
    '@nuxt/image',
    '@nuxt/ui',
    '@nuxt/content',
    'nuxt-og-image',
    'nuxt-llms',
    '@nuxtjs/mcp-toolkit',
    '@nuxt/a11y',
    '@nuxt/hints',
    '@nuxt/scripts'
  ],

  site: {
    url: 'https://nuxt-customer-portal.com',
    name: 'Customer Portal'
  },

  runtimeConfig: {
    public: {
      docsRepositoryUrl: documentationDefaults.docsRepositoryUrl,
      docsRepositoryBranch: documentationDefaults.docsRepositoryBranch,
      docsFeedbackRepositoryUrl: documentationDefaults.feedbackRepositoryUrl,
      productRepositoryUrl: documentationDefaults.productRepositoryUrl,
      productSourceCommit: documentationDefaults.productSourceCommit
    }
  },

  devtools: {
    enabled: true
  },

  css: ['~/assets/css/main.css'],

  content: {
    build: {
      markdown: {
        highlight: {
          theme: {
            default: 'github-light-high-contrast',
            light: 'github-light-high-contrast',
            dark: 'github-dark-high-contrast'
          }
        },
        toc: {
          searchDepth: 1
        }
      }
    }
  },

  compatibilityDate: '2026-07-19',

  nitro: {
    prerender: {
      concurrency: 1,
      routes: [
        '/',
        '/robots.txt',
        '/sitemap.xml'
      ],
      crawlLinks: true,
      autoSubfolderIndex: false
    }
  },

  ogImage: {
    buildCache: true,
    security: {
      renderTimeout: 30_000
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

  icon: {
    provider: 'none',
    clientBundle: {
      scan: true,
      icons: [
        'lucide:terminal',
        'vscode-icons:file-type-dotenv',
        'vscode-icons:file-type-typescript',
        'vscode-icons:file-type-json',
        'vscode-icons:file-type-node',
        'vscode-icons:file-type-nuxt',
        'vscode-icons:file-type-vue'
      ]
    }
  },

  colorMode: {
    storage: 'cookie'
  },

  llms: {
    domain: 'https://nuxt-customer-portal.com',
    title: 'Customer Portal documentation',
    description: `Build, extend, and contribute to the publicly developed Customer Portal for Nuxt. Verified against source revision ${documentationDefaults.productSourceCommit}.`,
    contentRawMarkdown: false,
    full: {
      title: 'Customer Portal — full documentation',
      description: `Architecture, setup, operations, feature-layer development, modules, and contribution guides for Customer Portal, verified against source revision ${documentationDefaults.productSourceCommit}.`
    },
    sections: [
      {
        title: 'Getting Started',
        contentCollection: 'docs',
        contentFilters: [
          { field: 'path', operator: 'LIKE', value: '/getting-started%' }
        ]
      },
      {
        title: 'Architecture',
        contentCollection: 'docs',
        contentFilters: [
          { field: 'path', operator: 'LIKE', value: '/architecture%' }
        ]
      },
      {
        title: 'Modules',
        contentCollection: 'docs',
        contentFilters: [
          { field: 'path', operator: 'LIKE', value: '/modules%' }
        ]
      },
      {
        title: 'Reference',
        contentCollection: 'docs',
        contentFilters: [
          { field: 'path', operator: 'LIKE', value: '/reference%' }
        ]
      },
      {
        title: 'Operations',
        contentCollection: 'docs',
        contentFilters: [
          { field: 'path', operator: 'LIKE', value: '/operations%' }
        ]
      },
      {
        title: 'User Guides',
        contentCollection: 'docs',
        contentFilters: [
          { field: 'path', operator: 'LIKE', value: '/guides%' }
        ]
      },
      {
        title: 'Contributing',
        contentCollection: 'docs',
        contentFilters: [
          { field: 'path', operator: 'LIKE', value: '/contributing%' }
        ]
      }
    ]
  },

  mcp: {
    name: 'Customer Portal documentation'
  }
})
