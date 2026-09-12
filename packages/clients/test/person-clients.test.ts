import assert from 'node:assert/strict'
import test from 'node:test'
import {
  genericClientCreateSchema,
  clientUpdateSchema,
  genericClientListQuerySchema
} from '../server/utils/client-validation'
import { definePortalConfig } from '../../kit/src/runtime.mjs'

test('existing company creation defaults to organization and still needs company fields', () => {
  assert.equal(
    genericClientCreateSchema.parse({ name: 'Company', slug: 'company', officialName: 'Company BV' }).clientType,
    'organization'
  )
  assert.equal(genericClientCreateSchema.safeParse({ name: 'Company' }).success, false)
})
test('person creation requires no slug or company name and rejects company fields', () => {
  assert.equal(
    genericClientCreateSchema.safeParse({
      name: 'Preferred display',
      firstName: 'Private',
      lastName: 'Client',
      clientType: 'person',
      timezone: 'Europe/Amsterdam'
    }).success,
    true
  )
  for (const extra of [{ vatNumber: 'NL123' }, { registrationNumber: '123' }, { timezone: '+02:00' }]) {
    assert.equal(
      genericClientCreateSchema.safeParse({
        name: 'Private Client',
        firstName: 'Private',
        lastName: 'Client',
        clientType: 'person',
        ...extra
      }).success,
      false
    )
  }
})
test('updates preserve client type and validate saved timezone overrides', () => {
  assert.equal(clientUpdateSchema.safeParse({ clientType: 'person' }).success, false)
  assert.deepEqual(clientUpdateSchema.parse({ timezone: null }), { timezone: null })
  assert.equal(clientUpdateSchema.safeParse({}).success, false)
  assert.equal(clientUpdateSchema.safeParse({ timezone: 'Europe/Amsterdam' }).success, true)
  assert.equal(clientUpdateSchema.safeParse({ timezone: 'invalid' }).success, false)
  assert.equal(genericClientListQuerySchema.parse({ clientType: 'person' }).clientType, 'person')
})
test('personal name parts are updated together and remain independent from display name', () => {
  assert.deepEqual(clientUpdateSchema.parse({ name: 'Display name', firstName: 'First', lastName: 'Last' }), {
    name: 'Display name',
    firstName: 'First',
    lastName: 'Last'
  })
  assert.equal(clientUpdateSchema.safeParse({ firstName: 'First' }).success, false)
  assert.equal(clientUpdateSchema.safeParse({ lastName: 'Last' }).success, false)
})
test('configuration is B2B by default and validates personal registration', () => {
  assert.deepEqual(definePortalConfig({ layers: ['@nuxt-customer-portal/preset'] }).clients.allowedTypes, [
    'organization'
  ])
  assert.equal(
    definePortalConfig({
      layers: ['@nuxt-customer-portal/preset'],
      clients: { allowedTypes: ['organization', 'person'], personalSelfRegistration: true }
    }).clients.personalSelfRegistration,
    true
  )
  assert.throws(() =>
    definePortalConfig({ layers: ['@nuxt-customer-portal/preset'], clients: { personalSelfRegistration: true } })
  )
  assert.throws(() => definePortalConfig({ layers: ['@nuxt-customer-portal/preset'], clients: { allowedTypes: [] } }))
})

test('runtime rejects B2B personal creation and incompatible authentication registration', async () => {
  const { getClientConfiguration, requireAllowedClientType } = await import('../server/utils/client-configuration')
  const globals = globalThis as unknown as { useRuntimeConfig: () => unknown }
  const original = globals.useRuntimeConfig
  const originalMode = process.env.PORTAL_REGISTRATION_MODE
  delete process.env.PORTAL_REGISTRATION_MODE
  try {
    globals.useRuntimeConfig = () => ({ public: { clients: {} }, portalAuth: { registrationMode: 'open' } })
    await assert.rejects(() => requireAllowedClientType('person'), { statusCode: 403 })
    await requireAllowedClientType('organization')
    for (const registrationMode of ['invitation-only', 'disabled']) {
      globals.useRuntimeConfig = () => ({
        public: { clients: { allowedTypes: ['organization', 'person'], personalSelfRegistration: true } },
        portalAuth: { registrationMode }
      })
      await assert.rejects(getClientConfiguration, /open authentication/)
    }
  } finally {
    globals.useRuntimeConfig = original
    if (originalMode === undefined) {
      delete process.env.PORTAL_REGISTRATION_MODE
    } else {
      process.env.PORTAL_REGISTRATION_MODE = originalMode
    }
  }
})

test('requests wait for configuration validation and fail closed', async () => {
  const { setClientConfigurationValidation, requireClientConfigurationReady } =
    await import('../server/utils/client-configuration')
  setClientConfigurationValidation(Promise.resolve('Cannot disable a client type while clients exist'))
  await assert.rejects(requireClientConfigurationReady, { statusCode: 503 })
  setClientConfigurationValidation(Promise.resolve(null))
  await requireClientConfigurationReady()
})
