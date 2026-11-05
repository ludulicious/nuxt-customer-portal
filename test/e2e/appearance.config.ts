import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: '.',
  testMatch: 'appearance.spec.ts',
  outputDir: '../../test-results/appearance',
  reporter: 'list',
  use: { ...devices['Desktop Chrome'] }
})
