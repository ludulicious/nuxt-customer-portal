import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: '.',
  testMatch: 'invoice-lines.spec.ts',
  outputDir: '../../test-results/invoice-lines',
  reporter: 'list',
  use: { ...devices['Desktop Chrome'] }
})
