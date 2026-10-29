import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: '.',
  testMatch: 'media.spec.ts',
  fullyParallel: false,
  timeout: 90000,
  expect: { timeout: 20000 },
  outputDir: '../../test-results/media',
  reporter: 'list',
  use: {
    ...devices['Desktop Chrome'],
    actionTimeout: 20000,
    baseURL: process.env.PORTAL_MEDIA_E2E_URL || 'http://localhost:55440',
    extraHTTPHeaders: { Origin: process.env.PORTAL_MEDIA_E2E_URL || 'http://localhost:55440' },
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure'
  }
})
