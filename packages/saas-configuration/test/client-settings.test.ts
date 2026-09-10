import assert from 'node:assert/strict'
import test from 'node:test'
import { portalClientsSchema, portalSettingsSchema, defaultPortalSettings } from '../shared/settings'

test('client settings require an allowed type and private clients for self-registration', () => {
  assert.equal(portalClientsSchema.safeParse({ allowedTypes: [], personalSelfRegistration: false }).success, false)
  assert.equal(
    portalClientsSchema.safeParse({ allowedTypes: ['organization'], personalSelfRegistration: true }).success,
    false
  )
  for (const allowedTypes of [['organization'], ['person'], ['organization', 'person']]) {
    assert.equal(portalClientsSchema.safeParse({ allowedTypes, personalSelfRegistration: false }).success, true)
  }
  assert.equal(
    portalClientsSchema.safeParse({ allowedTypes: ['person'], personalSelfRegistration: true }).success,
    true
  )
})
test('legacy settings default to organization clients when no host override is supplied', () => {
  const { clients: _clients, ...legacy } = defaultPortalSettings('Portal')
  assert.deepEqual(portalSettingsSchema.parse(legacy).clients, {
    allowedTypes: ['organization'],
    personalSelfRegistration: false
  })
})
