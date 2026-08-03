import { fileURLToPath } from 'node:url'

export default defineNuxtConfig({
  compatibilityDate: '2025-10-24',
  modules: ['@nuxtjs/i18n'],
  css: [fileURLToPath(new URL('./app/assets/timesheets.css', import.meta.url))],
  i18n: {
    locales: [
      { code: 'en', iso: 'en-US', name: 'English', file: 'en.json' },
      { code: 'nl', iso: 'nl-NL', name: 'Nederlands', file: 'nl.json' }
    ]
  }
})
