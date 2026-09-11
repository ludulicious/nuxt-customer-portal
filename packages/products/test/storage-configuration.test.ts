import assert from 'node:assert/strict'
import test from 'node:test'
import {
  decryptStorageSecret,
  encryptStorageSecret,
  testStorageConfiguration
} from '../server/utils/storage-configuration'

test('stored S3 secrets are authenticated, encrypted, and bound to the configured key', () => {
  process.env.PRODUCTS_STORAGE_ENCRYPTION_KEY = 'first-products-storage-encryption-key'
  const encrypted = encryptStorageSecret('super-secret-access-key')
  assert.notEqual(encrypted, 'super-secret-access-key')
  assert.equal(decryptStorageSecret(encrypted), 'super-secret-access-key')
  assert.throws(() => decryptStorageSecret(`${encrypted.slice(0, -1)}x`), /could not be decrypted/)
  process.env.PRODUCTS_STORAGE_ENCRYPTION_KEY = 'second-products-storage-encryption-key'
  assert.throws(() => decryptStorageSecret(encrypted), /could not be decrypted/)
  delete process.env.PRODUCTS_STORAGE_ENCRYPTION_KEY
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
  assert.deepEqual(requests.map(({ method }) => method), ['PUT', 'GET', 'DELETE'])
  assert.ok(requests.every(({ url }) => url.includes('/product-zone/products/health/')))
  assert.ok(requests.every(({ accessKey }) => accessKey === 'zone-password'))
})
