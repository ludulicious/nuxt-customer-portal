import assert from 'node:assert/strict'
import test from 'node:test'
import { db } from '../server/utils/db'
import { decryptPortalEmailSecret, savePortalEmailSettings } from '../server/utils/portal-email'

test('provider saves never write a key without valid encryption and retain the previous key when omitted', async (context) => {
  const previousRoot = process.env.PORTAL_ENCRYPTION_KEY
  const previousOverride = process.env.PORTAL_EMAIL_ENCRYPTION_KEY
  const previousRuntime = Reflect.get(globalThis, 'useRuntimeConfig')
  const previousStorage = Reflect.get(globalThis, 'useStorage')
  let saved: Record<string, unknown> | null = null
  let writes = 0
  context.mock.method(
    db,
    'select',
    () =>
      ({
        from: () => ({ where: () => ({ limit: async () => (saved ? [saved] : []) }) })
      }) as unknown as ReturnType<typeof db.select>
  )
  context.mock.method(
    db,
    'insert',
    () =>
      ({
        values: (values: Record<string, unknown>) => ({
          onConflictDoUpdate: async () => {
            writes++
            saved = values
          }
        })
      }) as unknown as ReturnType<typeof db.insert>
  )
  Reflect.set(globalThis, 'useRuntimeConfig', () => ({ portalEmail: {} }))
  Reflect.set(globalThis, 'useStorage', () => ({ getItem: async () => '{{body}}' }))
  const input = {
    apiKey: 're_private-provider-key',
    fromName: 'Test sender',
    fromEmail: 'sender@example.com',
    defaultLocale: 'en' as const,
    htmlTemplate: null,
    textOverrides: {}
  }
  try {
    delete process.env.PORTAL_EMAIL_ENCRYPTION_KEY
    delete process.env.PORTAL_ENCRYPTION_KEY
    await assert.rejects(savePortalEmailSettings('admin', input), { statusCode: 503 })
    process.env.PORTAL_ENCRYPTION_KEY = 'invalid-key'
    await assert.rejects(savePortalEmailSettings('admin', input), { statusCode: 503 })
    assert.equal(writes, 0)

    process.env.PORTAL_ENCRYPTION_KEY = Buffer.alloc(32, 3).toString('base64')
    const result = await savePortalEmailSettings('admin', input)
    assert.equal(writes, 1)
    assert.equal(result.configured, true)
    assert.equal(result.keyLastFour, input.apiKey.slice(-4))
    assert.doesNotMatch(JSON.stringify(result), /re_private-provider-key/)
    const stored = saved as unknown as { encryptedApiKey: string }
    assert.notEqual(stored.encryptedApiKey, input.apiKey)
    assert.equal(decryptPortalEmailSecret(stored.encryptedApiKey), input.apiKey)

    delete process.env.PORTAL_ENCRYPTION_KEY
    await savePortalEmailSettings('admin', { ...input, apiKey: undefined, fromName: 'Updated sender' })
    assert.equal(writes, 2)
    assert.equal((saved as unknown as { encryptedApiKey: string }).encryptedApiKey, stored.encryptedApiKey)
  } finally {
    for (const [name, value] of [
      ['PORTAL_ENCRYPTION_KEY', previousRoot],
      ['PORTAL_EMAIL_ENCRYPTION_KEY', previousOverride]
    ] as const) {
      if (value === undefined) {
        Reflect.deleteProperty(process.env, name)
      } else {
        process.env[name] = value
      }
    }
    for (const [name, value] of [
      ['useRuntimeConfig', previousRuntime],
      ['useStorage', previousStorage]
    ] as const) {
      if (value === undefined) {
        Reflect.deleteProperty(globalThis, name)
      } else {
        Reflect.set(globalThis, name, value)
      }
    }
  }
})
