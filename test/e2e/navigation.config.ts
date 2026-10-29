import { defineConfig } from '@playwright/test'
import mediaConfig from './media.config'

export default defineConfig({
  ...mediaConfig,
  testMatch: 'navigation.spec.ts',
  outputDir: '../../test-results/navigation'
})
