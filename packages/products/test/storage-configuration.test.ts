import assert from 'node:assert/strict'
import test from 'node:test'
import {
  decryptStorageSecret,
  encryptStorageSecret,
  testStorageConfiguration
} from '../server/utils/storage-configuration'

const tamperAuthenticationTag = (value: string) => {
  const parts = value.split('.')
  parts[4] = `${parts[4]!.startsWith('A') ? 'B' : 'A'}${parts[4]!.slice(1)}`
  return parts.join('.')
}

test('stored S3 secrets use the portal encryption key by default', () => {
  const originalRoot = process.env.PORTAL_ENCRYPTION_KEY
  const originalStorage = process.env.PRODUCTS_STORAGE_ENCRYPTION_KEY
  delete process.env.PRODUCTS_STORAGE_ENCRYPTION_KEY
  process.env.PORTAL_ENCRYPTION_KEY = Buffer.alloc(32, 3).toString('base64')
  try {
    const encrypted = encryptStorageSecret('super-secret-access-key')
    assert.notEqual(encrypted, 'super-secret-access-key')
    assert.equal(decryptStorageSecret(encrypted), 'super-secret-access-key')
    assert.throws(() => decryptStorageSecret(tamperAuthenticationTag(encrypted)), /could not be decrypted/)
  } finally {
    if (originalRoot === undefined) delete process.env.PORTAL_ENCRYPTION_KEY
    else process.env.PORTAL_ENCRYPTION_KEY = originalRoot
    if (originalStorage === undefined) delete process.env.PRODUCTS_STORAGE_ENCRYPTION_KEY
    else process.env.PRODUCTS_STORAGE_ENCRYPTION_KEY = originalStorage
  }
})

test('Bunny proprietary API health check uploads, reads, and removes a probe', async () => {
  const originalFetch = globalThis.fetch
  const requests: Array<{ method: string; url: string; accessKey: string | null }> = []
  globalThis.fetch = (async (input, init) => {
    const headers = new Headers(init?.headers)
    requests.push({
      method: init?.method || 'GET',
      url: String(input),
      accessKey: headers.get('AccessKey')
    })
    return new Response(init?.method === 'GET' || !init?.method ? new Uint8Array() : undefined, { status: 200 })
  }) as typeof fetch
  try {
    await testStorageConfiguration({
      provider: 'bunny',
      source: 'store',
      endpoint: 'https://storage.bunnycdn.test',
      bucket: 'product-zone',
      region: '',
      pathStyle: false,
      credentials: { accessKeyId: '', secretAccessKey: 'zone-password' },
      tested: false
    })
  } finally {
    globalThis.fetch = originalFetch
  }
  assert.deepEqual(
    requests.map(({ method }) => method),
    ['PUT', 'GET', 'DELETE']
  )
  assert.ok(requests.every(({ url }) => url.includes('/product-zone/products/health/')))
  assert.ok(requests.every(({ accessKey }) => accessKey === 'zone-password'))
})
