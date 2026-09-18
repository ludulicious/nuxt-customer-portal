import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { defaultPortalSettings, portalSettingsSchema, resolveBrandAsset } from '../shared/settings'

test('default SaaS portal settings are complete and bilingual', () => {
  const settings = defaultPortalSettings('Acme Portal')
  assert.equal(portalSettingsSchema.safeParse(settings).success, true)
  assert.equal(settings.branding.portalName, 'Acme Portal')
  assert.ok(settings.content.en.terms.title)
  assert.ok(settings.content.nl.privacy.title)
})

test('invoice-timesheets requires both source modules', () => {
  const settings = defaultPortalSettings()
  settings.enabledModules = ['invoice-timesheets']
  assert.equal(portalSettingsSchema.safeParse(settings).success, false)
})

test('branding assets fall back across color modes', () => {
  const branding = defaultPortalSettings().branding
  branding.logoLight = 'data:image/png;base64,YQ=='
  assert.equal(resolveBrandAsset(branding, 'logo', true), branding.logoLight)
})

test('the deployable app includes its settings migration and image contract', async () => {
  const [config, dockerfile, migration, releaseWorkflow] = await Promise.all([
    readFile(new URL('../../../apps/saas-portal/portal.config.ts', import.meta.url), 'utf8'),
    readFile(new URL('../../../apps/saas-portal/Dockerfile', import.meta.url), 'utf8'),
    readFile(new URL('../migrations/0000_portal_settings.sql', import.meta.url), 'utf8'),
    readFile(new URL('../../../.github/workflows/release-portal-image.yml', import.meta.url), 'utf8')
  ])
  assert.match(config, /@nuxt-customer-portal\/saas-configuration/)
  assert.match(dockerfile, /saas-portal build/)
  assert.match(releaseWorkflow, /file: apps\/saas-portal\/Dockerfile/)
  assert.doesNotMatch(releaseWorkflow, /file: apps\/demo-apex\/Dockerfile/)
  assert.match(migration, /CHECK \("id" = true\)/)
})

test('fresh SaaS signup enters organization onboarding without enabling public personal signup', async () => {
  const [config, signupPage, onboardingMiddleware] = await Promise.all([
    readFile(new URL('../../../apps/saas-portal/portal.config.ts', import.meta.url), 'utf8'),
    readFile(new URL('../../authentication/app/pages/signup.vue', import.meta.url), 'utf8'),
    readFile(new URL('../app/middleware/00-portal-onboarding.global.ts', import.meta.url), 'utf8')
  ])

  assert.match(config, /allowedTypes: \['organization', 'person'\]/)
  assert.match(config, /personalSelfRegistration: false/)
  assert.match(signupPage, /personalSelfRegistration[\s\S]+!route\.query\.invitationId/)
  assert.match(signupPage, /personalSignup\.value \? '\/personal-onboarding'[\s\S]+\|\| '\/dashboard'/)
  assert.match(onboardingMiddleware, /session\.value\?\.user\?\.role === 'admin'[\s\S]+navigateTo\('\/onboarding'/)
})

test('UI languages use the bundled language set with at least one selected', () => {
  const settings = defaultPortalSettings()
  assert.deepEqual(settings.languages, ['en', 'nl'])
  assert.deepEqual(portalSettingsSchema.parse({ ...settings, languages: undefined }).languages, ['en', 'nl'])
  assert.equal(portalSettingsSchema.safeParse({ ...settings, languages: [] }).success, false)
  assert.equal(portalSettingsSchema.safeParse({ ...settings, languages: ['en', 'en'] }).success, false)
  assert.equal(portalSettingsSchema.safeParse({ ...settings, languages: ['fr'] }).success, false)
  assert.equal(portalSettingsSchema.safeParse({ ...settings, languages: ['nl'] }).success, true)
})
