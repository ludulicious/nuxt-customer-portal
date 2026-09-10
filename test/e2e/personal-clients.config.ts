import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: '.',
  timeout: 60000,
  expect: { timeout: 20000 },
  testMatch: 'personal-clients.spec.ts',
  fullyParallel: false,
  outputDir: '../../test-results/personal-clients',
  reporter: 'list',
  use: {
    ...devices['Desktop Chrome'],
    extraHTTPHeaders: { Origin: process.env.PORTAL_PERSONAL_E2E_URL || 'http://localhost:4193' },
    baseURL: process.env.PORTAL_PERSONAL_E2E_URL || 'http://localhost:4193'
  }
})
