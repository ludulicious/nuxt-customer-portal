import assert from 'node:assert/strict'
import test from 'node:test'
import { defaultPortalSettings, portalSettingsSchema } from '../shared/settings'

test('existing SaaS settings opt out of external website access and each instance has its own origins', () => {
  const { websiteOrigins: _origins, ...legacy } = defaultPortalSettings()
  assert.deepEqual(portalSettingsSchema.parse(legacy).websiteOrigins, [])
  const marpos = defaultPortalSettings('Marpos')
  marpos.websiteOrigins = ['https://www.marpos.nl/']
  assert.deepEqual(portalSettingsSchema.parse(marpos).websiteOrigins, ['https://www.marpos.nl'])
  assert.deepEqual(defaultPortalSettings('Another portal').websiteOrigins, [])
  marpos.websiteOrigins = ['https://*.marpos.nl']
  assert.equal(portalSettingsSchema.safeParse(marpos).success, false)
})
