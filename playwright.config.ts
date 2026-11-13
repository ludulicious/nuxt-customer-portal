import { defineConfig, devices } from '@playwright/test'

const connection = process.env.E2E_DATABASE_URL
if (!connection) {
  throw new Error('Set E2E_DATABASE_URL to a disposable PostgreSQL database ending in _e2e')
}
const normalDatabase = new URL(connection)
if (!normalDatabase.pathname.endsWith('_e2e')) {
  throw new Error('E2E_DATABASE_URL must name a disposable database ending in _e2e')
}
const demoDatabase = new URL(connection)
demoDatabase.pathname += '_demo'
const portalUrl = process.env.E2E_PORTAL_URL || 'http://localhost:4181'
const demoUrl = process.env.E2E_DEMO_URL || 'http://localhost:4182'
const sharedEnv = {
  BETTER_AUTH_SECRET: 'portal-e2e-secret-at-least-32-characters',
  PORTAL_ENCRYPTION_KEY: Buffer.alloc(32, 1).toString('base64'),
  ADMIN_EMAILS: 'owner@example.test',
  PORTAL_PROVIDER_NAME: 'Test Portal',
  PORTAL_PROVIDER_SLUG: 'portal-e2e',
  PORTAL_REGISTRATION_MODE: 'open',
  RESEND_API_KEY: '',
  RESEND_FROM_EMAIL: '',
  GOOGLE_CLIENT_ID: '',
  GOOGLE_CLIENT_SECRET: '',
  GITHUB_CLIENT_ID: '',
  GITHUB_CLIENT_SECRET: ''
}
export default defineConfig({
  testDir: './test/e2e',
  testMatch: 'portal.spec.ts',
  outputDir: './test-results/portal',
  fullyParallel: false,
  workers: 1,
  timeout: 60000,
  expect: { timeout: 15000 },
  reporter: process.env.CI ? [['list'], ['json', { outputFile: 'test-results/portal/results.json' }]] : 'list',
  use: { screenshot: 'only-on-failure', trace: 'retain-on-failure' },
  webServer: process.env.E2E_EXTERNAL_SERVERS
    ? undefined
    : [
        {
          command: 'pnpm preview --port 4181',
          url: 'http://localhost:4181/api/health',
          reuseExistingServer: false,
          timeout: 120000,
          env: {
            ...sharedEnv,
            DATABASE_URL: normalDatabase.href,
            PUBLIC_URL: 'http://localhost:4181',
            BETTER_AUTH_URL: 'http://localhost:4181',
            NUXT_PORTAL_DEMO_ENABLED: 'false',
            NUXT_PUBLIC_PORTAL_DEMO_ENABLED: 'false'
          }
        },
        {
          command: 'pnpm preview --port 4182',
          url: 'http://localhost:4182/api/health',
          reuseExistingServer: false,
          timeout: 120000,
          env: {
            ...sharedEnv,
            DATABASE_URL: demoDatabase.href,
            PUBLIC_URL: 'http://localhost:4182',
            BETTER_AUTH_URL: 'http://localhost:4182',
            NUXT_PORTAL_DEMO_ENABLED: 'true',
            NUXT_PUBLIC_PORTAL_DEMO_ENABLED: 'true'
          }
        }
      ],
  projects: [
    { name: 'portal-desktop', use: { ...devices['Desktop Chrome'], baseURL: portalUrl } },
    { name: 'portal-mobile', use: { ...devices['Pixel 7'], baseURL: portalUrl } },
    { name: 'demo-desktop', use: { ...devices['Desktop Chrome'], baseURL: demoUrl } },
    { name: 'demo-mobile', use: { ...devices['Pixel 7'], baseURL: demoUrl } }
  ]
})
