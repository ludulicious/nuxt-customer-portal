import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { runInNewContext } from 'node:vm'
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

test('public portal settings never expose connected website origins', async () => {
  const settings = defaultPortalSettings()
  settings.websiteOrigins = ['https://private-client.example']
  const source = readFileSync(new URL('../server/api/portal/public.get.ts', import.meta.url), 'utf8')
  const handler = runInNewContext(source.replace('export default ', ''), {
    defineEventHandler: (callback: () => Promise<unknown>) => callback,
    readPortalSettings: async () => ({ settings, completed: true })
  })
  const result = await handler()
  assert.equal(result.completed, true)
  assert.equal(Object.hasOwn(result, 'websiteOrigins'), false)
  assert.equal(JSON.stringify(result).includes('private-client.example'), false)
})
