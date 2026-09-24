import assert from 'node:assert/strict'
import test from 'node:test'
import { isPublicStoreRoute } from '../server/utils/public-api-route'

test('guest booking allows only public availability and hold operations', () => {
  assert.equal(isPublicStoreRoute('GET', '/api/store/planning/product/availability'), true)
  assert.equal(isPublicStoreRoute('POST', '/api/store/planning/holds'), true)
  assert.equal(isPublicStoreRoute('GET', '/api/store/planning/hold'), true)
  assert.equal(isPublicStoreRoute('DELETE', '/api/store/planning/hold'), true)
  assert.equal(isPublicStoreRoute('POST', '/api/store/planning/product/availability'), false)
  assert.equal(isPublicStoreRoute('GET', '/api/store/planning/holds'), false)
  assert.equal(isPublicStoreRoute('PUT', '/api/store/planning/hold'), false)
  assert.equal(isPublicStoreRoute('GET', '/api/store/planning/product/availability/extra'), false)
  assert.equal(isPublicStoreRoute('GET', '/api/planning/admin/policy'), false)
  assert.equal(isPublicStoreRoute('GET', '/api/planning/appointments'), false)
})

test('sandbox checkout remains public for anonymous purchases', () => {
  const path = '/api/store/sandbox-checkout/d3b338a6-dd4f-4fba-a22c-69c27f4b8152'

  assert.equal(isPublicStoreRoute('GET', path), true)
  assert.equal(isPublicStoreRoute('POST', path), true)
})

test('sandbox checkout only accepts a single order id segment', () => {
  assert.equal(isPublicStoreRoute('GET', '/api/store/sandbox-checkout'), false)
  assert.equal(isPublicStoreRoute('GET', '/api/store/sandbox-checkout/order/extra'), false)
  assert.equal(isPublicStoreRoute('DELETE', '/api/store/sandbox-checkout/order'), false)
})

test('Google Calendar notifications reach their channel-token authenticated handler', () => {
  assert.equal(isPublicStoreRoute('POST', '/api/planning/google/notifications'), true)
  assert.equal(isPublicStoreRoute('GET', '/api/planning/google/notifications'), false)
  assert.equal(isPublicStoreRoute('POST', '/api/planning/google/notifications/extra'), false)
})
