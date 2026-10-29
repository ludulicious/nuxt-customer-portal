import assert from 'node:assert/strict'
import test from 'node:test'
import { isMediaLibraryRoute, isPublicStoreRoute } from '../server/utils/public-api-route'

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

test('guest purchase routes allow only the file listing and download GET endpoints', () => {
  for (const path of ['/api/store/purchases/token', '/api/store/purchases/token/files/file']) {
    assert.equal(isPublicStoreRoute('GET', path), true)
    assert.equal(isPublicStoreRoute('POST', path), false)
    assert.equal(isPublicStoreRoute('DELETE', path), false)
  }
  assert.equal(isPublicStoreRoute('GET', '/api/store/purchases'), false)
  assert.equal(isPublicStoreRoute('GET', '/api/store/purchases/token/files'), false)
  assert.equal(isPublicStoreRoute('GET', '/api/store/purchases/token/files/file/extra'), false)
})

test('account-free order details expose only their token-scoped read endpoint', () => {
  assert.equal(isPublicStoreRoute('GET', '/api/store/purchases/token/details'), true)
  for (const method of ['POST', 'PUT', 'DELETE']) {
    assert.equal(isPublicStoreRoute(method, '/api/store/purchases/token/details'), false)
  }
  assert.equal(isPublicStoreRoute('GET', '/api/store/purchases/token/details/extra'), false)
  assert.equal(isPublicStoreRoute('GET', '/api/products/admin/orders/order/link'), false)
})

test('public store wording is read-only and administrative editing stays protected', () => {
  assert.equal(isPublicStoreRoute('GET', '/api/store/page-texts/order-details'), true)
  for (const method of ['POST', 'PUT', 'DELETE']) {
    assert.equal(isPublicStoreRoute(method, '/api/store/page-texts/order-details'), false)
  }
  assert.equal(isPublicStoreRoute('GET', '/api/store/page-texts/unknown'), false)
  assert.equal(isPublicStoreRoute('GET', '/api/products/admin/page-texts'), false)
})

test('media library delegates only its own path boundary to scoped authentication', () => {
  for (const method of ['GET', 'POST', 'PUT', 'DELETE']) {
    assert.equal(isMediaLibraryRoute(method, '/api/products/media'), true)
    assert.equal(isMediaLibraryRoute(method, '/api/products/media/uploads/upload/file'), true)
    assert.equal(isMediaLibraryRoute(method, '/api/products/media-other'), false)
    assert.equal(isMediaLibraryRoute(method, '/api/products/admin/products'), false)
  }
  assert.equal(isMediaLibraryRoute('PATCH', '/api/products/media'), false)
})
