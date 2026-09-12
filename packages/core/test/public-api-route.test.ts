import assert from 'node:assert/strict'
import test from 'node:test'
import { isPublicStoreRoute } from '../server/utils/public-api-route'

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
