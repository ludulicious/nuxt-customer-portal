import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './test/e2e',
  outputDir: './test-results/demo-shells',
  fullyParallel: true,
  reporter: 'list',
  webServer: [
    {
      command: 'pnpm --filter @nuxt-customer-portal/demo-apex preview --port 4181',
      url: 'http://localhost:4181',
      reuseExistingServer: !process.env.CI,
      env: {
        DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/customer_portal_e2e',
        PUBLIC_URL: 'http://localhost:4181',
        BETTER_AUTH_URL: 'http://localhost:4181',
        BETTER_AUTH_SECRET: 'demo-e2e-secret-at-least-32-characters'
      }
    },
    {
      command: 'pnpm --filter @nuxt-customer-portal/demo-brutal preview --port 4182',
      url: 'http://localhost:4182',
      reuseExistingServer: !process.env.CI,
      env: {
        DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/customer_portal_e2e',
        PUBLIC_URL: 'http://localhost:4182',
        BETTER_AUTH_URL: 'http://localhost:4182',
        BETTER_AUTH_SECRET: 'demo-e2e-secret-at-least-32-characters'
      }
    }
  ],
  projects: [
    { name: 'apex-desktop', use: { ...devices['Desktop Chrome'], baseURL: 'http://localhost:4181' } },
    { name: 'apex-mobile', use: { ...devices['Pixel 7'], baseURL: 'http://localhost:4181' } },
    { name: 'brutal-desktop', use: { ...devices['Desktop Chrome'], baseURL: 'http://localhost:4182' } },
    { name: 'brutal-mobile', use: { ...devices['Pixel 7'], baseURL: 'http://localhost:4182' } }
  ]
})
