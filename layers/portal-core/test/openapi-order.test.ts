import assert from 'node:assert/strict'
import test from 'node:test'
import { orderOpenApiDocument } from '../../../server/utils/openapi-order'

test('orders OpenAPI paths by module menu and operation lifecycle', () => {
  const document = orderOpenApiDocument({
    paths: {
      '/api/timesheets/admin/activities/{id}': { delete: {}, patch: {} },
      '/api/timesheets/admin/invoices': { post: {}, get: {} },
      '/api/timesheets/admin/clients': { post: {}, get: {} },
      '/api/service-requests/admin': { get: {} },
      '/api/timesheets/admin/activities': { post: {}, get: {} },
      '/api/service-requests': { post: {}, get: {} },
      '/api/organizations/{id}': { get: {} }
    }
  })

  assert.deepEqual(Object.keys(document.paths ?? {}), [
    '/api/organizations/{id}',
    '/api/service-requests',
    '/api/service-requests/admin',
    '/api/timesheets/admin/clients',
    '/api/timesheets/admin/activities',
    '/api/timesheets/admin/activities/{id}',
    '/api/timesheets/admin/invoices'
  ])
  assert.deepEqual(Object.keys(document.paths?.['/api/timesheets/admin/activities'] ?? {}), ['get', 'post'])
  assert.deepEqual(Object.keys(document.paths?.['/api/timesheets/admin/activities/{id}'] ?? {}), ['patch', 'delete'])
})
