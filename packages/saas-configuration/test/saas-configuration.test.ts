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
  const [config, dockerfile, migration] = await Promise.all([
    readFile(new URL('../../../apps/saas-portal/portal.config.ts', import.meta.url), 'utf8'),
    readFile(new URL('../../../apps/saas-portal/Dockerfile', import.meta.url), 'utf8'),
    readFile(new URL('../migrations/0000_portal_settings.sql', import.meta.url), 'utf8')
  ])
  assert.match(config, /@nuxt-customer-portal\/saas-configuration/)
  assert.match(dockerfile, /saas-portal build/)
  assert.match(migration, /CHECK \("id" = true\)/)
})
