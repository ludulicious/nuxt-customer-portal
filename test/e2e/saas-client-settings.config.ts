import { defineConfig } from '@playwright/test'
export default defineConfig({
  testDir: '.',
  testMatch: 'saas-client-settings.spec.ts',
  timeout: 60000,
  reporter: 'list'
})
