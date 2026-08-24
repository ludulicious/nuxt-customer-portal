import assert from 'node:assert/strict'
import test from 'node:test'
import { z } from 'zod'
import { enrichOpenApiContracts, registerPortalOpenApiContracts } from '../server/utils/openapi-contracts'

test('adds query parameters and JSON request bodies from validation schemas', () => {
  registerPortalOpenApiContracts({
    owner: 'openapi-contract-test',
    query: { packageItemsGet: z.object({ page: z.coerce.number().int().positive().optional() }) },
    body: {
      packageItemsPost: z.object({ name: z.string().min(1) }),
      packageItemsByIdDelete: z.object({ confirmation: z.literal(true) })
    }
  })
  const document = enrichOpenApiContracts({
    paths: {
      '/api/package/items': {
        get: { operationId: 'packageItemsGet', parameters: [] },
        post: { operationId: 'packageItemsPost' }
      },
      '/api/package/items/{id}': {
        delete: { operationId: 'packageItemsByIdDelete', parameters: [{ name: 'id', in: 'path' }] }
      }
    }
  })

  const list = document.paths?.['/api/package/items']?.get
  const create = document.paths?.['/api/package/items']?.post
  const remove = document.paths?.['/api/package/items/{id}']?.delete
  assert.ok((list?.parameters as unknown[]).some((parameter) => (parameter as { name: string }).name === 'page'))
  assert.deepEqual(
    (create?.requestBody as { content: Record<string, unknown> }).content['application/json'] !== undefined,
    true
  )
  assert.deepEqual(
    (remove?.requestBody as { content: Record<string, unknown> }).content['application/json'] !== undefined,
    true
  )
})

test('documents invoice attachment uploads as multipart form data', () => {
  registerPortalOpenApiContracts({
    owner: 'multipart-contract-test',
    requestBody: {
      packageUploadPost: {
        required: true,
        content: { 'multipart/form-data': { schema: { type: 'object' } } }
      }
    }
  })
  const document = enrichOpenApiContracts({
    paths: { '/upload': { post: { operationId: 'packageUploadPost' } } }
  })
  const requestBody = document.paths?.['/upload']?.post.requestBody as { content: Record<string, unknown> }
  assert.ok(requestBody.content['multipart/form-data'])
})
