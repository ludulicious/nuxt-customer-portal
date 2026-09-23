import assert from 'node:assert/strict'
import { createCipheriv, createHash, randomBytes } from 'node:crypto'
import test from 'node:test'
import {
  decryptLegacyBinarySecret,
  decryptLegacyDotSecret,
  decryptPortalSecret,
  encryptPortalSecret
} from '../server/utils/portal-encryption'

const rootKey = Buffer.alloc(32, 7).toString('base64')
const options = { purpose: 'test/primary' }
const tamperAuthenticationTag = (value: string) => {
  const parts = value.split('.')
  parts[4] = `${parts[4]!.startsWith('A') ? 'B' : 'A'}${parts[4]!.slice(1)}`
  return parts.join('.')
}

test('portal secrets use a purpose-bound key derived from the shared root', () => {
  const original = process.env.PORTAL_ENCRYPTION_KEY
  process.env.PORTAL_ENCRYPTION_KEY = rootKey
  try {
    const encrypted = encryptPortalSecret('secret', options)
    assert.match(encrypted, /^v2\./)
    assert.equal(decryptPortalSecret(encrypted, options), 'secret')
    process.env.TEST_LATER_OVERRIDE = 'later-override'
    assert.equal(
      decryptPortalSecret(encrypted, {
        ...options,
        overrides: [{ env: 'TEST_LATER_OVERRIDE', format: 'sha256' }]
      }),
      'secret'
    )
    assert.throws(() => decryptPortalSecret(encrypted, { purpose: 'test/secondary' }), /different encryption purpose/)
    assert.throws(() => decryptPortalSecret(tamperAuthenticationTag(encrypted), options), /could not be decrypted/)
  } finally {
    delete process.env.TEST_LATER_OVERRIDE
    if (original === undefined) {
      delete process.env.PORTAL_ENCRYPTION_KEY
    } else {
      process.env.PORTAL_ENCRYPTION_KEY = original
    }
  }
})

test('module-specific keys override the portal key', () => {
  const originalRoot = process.env.PORTAL_ENCRYPTION_KEY
  const originalOverride = process.env.TEST_ENCRYPTION_KEY
  process.env.PORTAL_ENCRYPTION_KEY = rootKey
  process.env.TEST_ENCRYPTION_KEY = 'first-override'
  const overrideOptions = {
    purpose: 'test/override',
    overrides: [{ env: 'TEST_ENCRYPTION_KEY', format: 'sha256' as const }]
  }
  try {
    const encrypted = encryptPortalSecret('secret', overrideOptions)
    process.env.PORTAL_ENCRYPTION_KEY = Buffer.alloc(32, 8).toString('base64')
    assert.equal(decryptPortalSecret(encrypted, overrideOptions), 'secret')
    process.env.TEST_ENCRYPTION_KEY = 'second-override'
    assert.throws(() => decryptPortalSecret(encrypted, overrideOptions), /could not be decrypted/)
  } finally {
    if (originalRoot === undefined) {
      delete process.env.PORTAL_ENCRYPTION_KEY
    } else {
      process.env.PORTAL_ENCRYPTION_KEY = originalRoot
    }
    if (originalOverride === undefined) {
      delete process.env.TEST_ENCRYPTION_KEY
    } else {
      process.env.TEST_ENCRYPTION_KEY = originalOverride
    }
  }
})

test('portal key validation and missing-key errors are actionable', () => {
  const original = process.env.PORTAL_ENCRYPTION_KEY
  try {
    delete process.env.PORTAL_ENCRYPTION_KEY
    assert.throws(() => encryptPortalSecret('secret', options), /Configure PORTAL_ENCRYPTION_KEY/)
    process.env.PORTAL_ENCRYPTION_KEY = 'not-a-32-byte-key'
    assert.throws(() => encryptPortalSecret('secret', options), /base64-encoded 32-byte key/)
  } finally {
    if (original === undefined) {
      delete process.env.PORTAL_ENCRYPTION_KEY
    } else {
      process.env.PORTAL_ENCRYPTION_KEY = original
    }
  }
})

test('legacy dot and binary ciphertext remain decryptable with retained keys', () => {
  const originalHashed = process.env.TEST_HASHED_KEY
  const originalBase64 = process.env.TEST_BASE64_KEY
  process.env.TEST_HASHED_KEY = 'legacy-hashed-key'
  process.env.TEST_BASE64_KEY = Buffer.alloc(32, 9).toString('base64')
  try {
    const dotIv = randomBytes(12)
    const dotCipher = createCipheriv(
      'aes-256-gcm',
      createHash('sha256').update(process.env.TEST_HASHED_KEY).digest(),
      dotIv
    )
    const dotEncrypted = Buffer.concat([dotCipher.update('legacy-dot'), dotCipher.final()])
    const dotValue = [
      'v1',
      dotIv.toString('base64url'),
      dotCipher.getAuthTag().toString('base64url'),
      dotEncrypted.toString('base64url')
    ].join('.')
    assert.equal(decryptLegacyDotSecret(dotValue, [{ env: 'TEST_HASHED_KEY', format: 'sha256' }]), 'legacy-dot')

    const binaryIv = randomBytes(12)
    const binaryCipher = createCipheriv('aes-256-gcm', Buffer.from(process.env.TEST_BASE64_KEY, 'base64'), binaryIv)
    const binaryEncrypted = Buffer.concat([binaryCipher.update('legacy-binary'), binaryCipher.final()])
    const binaryValue = Buffer.concat([binaryIv, binaryCipher.getAuthTag(), binaryEncrypted]).toString('base64')
    assert.equal(
      decryptLegacyBinarySecret(binaryValue, [{ env: 'TEST_BASE64_KEY', format: 'base64-32' }]),
      'legacy-binary'
    )
  } finally {
    if (originalHashed === undefined) {
      delete process.env.TEST_HASHED_KEY
    } else {
      process.env.TEST_HASHED_KEY = originalHashed
    }
    if (originalBase64 === undefined) {
      delete process.env.TEST_BASE64_KEY
    } else {
      process.env.TEST_BASE64_KEY = originalBase64
    }
  }
})
