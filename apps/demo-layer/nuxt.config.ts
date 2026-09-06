import { fileURLToPath } from 'node:url'

export default defineNuxtConfig({
  nitro: {
    publicAssets: [{ dir: fileURLToPath(new URL('./public', import.meta.url)) }]
  },
  runtimeConfig: {
    portalDemo: { enabled: process.env.PORTAL_DEMO === 'true' },
    public: { portalDemo: { enabled: process.env.PORTAL_DEMO === 'true' } }
  }
})
