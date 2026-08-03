import assert from 'node:assert/strict'
import test from 'node:test'
import { enrichOpenApiContracts } from '../../../server/utils/openapi-contracts'

test('adds query parameters and JSON request bodies from validation schemas', () => {
  const document = enrichOpenApiContracts({
    paths: {
      '/api/timesheets/admin/activities': {
        get: { operationId: 'timesheetsAdminActivitiesGet', parameters: [] },
        post: { operationId: 'timesheetsAdminActivitiesPost' }
      },
      '/api/timesheets/admin/activities/{id}': {
        delete: { operationId: 'timesheetsAdminActivitiesByIdDelete', parameters: [{ name: 'id', in: 'path' }] }
      }
    }
  })

  const list = document.paths?.['/api/timesheets/admin/activities']?.get
  const create = document.paths?.['/api/timesheets/admin/activities']?.post
  const remove = document.paths?.['/api/timesheets/admin/activities/{id}']?.delete
  assert.ok((list?.parameters as unknown[]).some(parameter => (parameter as { name: string }).name === 'page'))
  assert.deepEqual((create?.requestBody as { content: Record<string, unknown> }).content['application/json'] !== undefined, true)
  assert.deepEqual((remove?.requestBody as { content: Record<string, unknown> }).content['application/json'] !== undefined, true)
})

test('documents invoice attachment uploads as multipart form data', () => {
  const document = enrichOpenApiContracts({
    paths: { '/upload': { post: { operationId: 'timesheetsAdminInvoicesByIdAttachmentsPost' } } }
  })
  const requestBody = document.paths?.['/upload']?.post.requestBody as { content: Record<string, unknown> }
  assert.ok(requestBody.content['multipart/form-data'])
})
