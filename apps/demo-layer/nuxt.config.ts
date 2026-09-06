export default defineNuxtConfig({
  runtimeConfig: {
    portalDemo: { enabled: process.env.PORTAL_DEMO === 'true' },
    public: { portalDemo: { enabled: process.env.PORTAL_DEMO === 'true' } }
  }
})
