import { fileURLToPath } from 'node:url'

export default defineNuxtConfig({
  runtimeConfig: {
    portalDemo: { enabled: process.env.PORTAL_DEMO === 'true' },
    public: { portalDemo: { enabled: process.env.PORTAL_DEMO === 'true' } }
  },
  nitro: {
    publicAssets: [{ dir: fileURLToPath(new URL('./public', import.meta.url)) }]
  }
})
