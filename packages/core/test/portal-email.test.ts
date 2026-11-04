import assert from 'node:assert/strict'
import test from 'node:test'
import {
  decryptPortalEmailSecret,
  encryptPortalEmailSecret,
  validatePortalEmailTemplate,
  validatePortalEmailText
} from '../server/utils/portal-email'
import { coreFeature } from '../shared/core-feature'

const tamperAuthenticationTag = (value: string) => {
  const parts = value.split('.')
  parts[4] = `${parts[4]!.startsWith('A') ? 'B' : 'A'}${parts[4]!.slice(1)}`
  return parts.join('.')
}

test('portal email credentials are encrypted, authenticated, and key-bound', () => {
  const originalRoot = process.env.PORTAL_ENCRYPTION_KEY
  const originalEmail = process.env.PORTAL_EMAIL_ENCRYPTION_KEY
  try {
    delete process.env.PORTAL_EMAIL_ENCRYPTION_KEY
    process.env.PORTAL_ENCRYPTION_KEY = Buffer.alloc(32, 1).toString('base64')
    const encrypted = encryptPortalEmailSecret('re_secret')
    assert.notEqual(encrypted, 're_secret')
    assert.equal(decryptPortalEmailSecret(encrypted), 're_secret')
    assert.throws(() => decryptPortalEmailSecret(tamperAuthenticationTag(encrypted)), /could not be decrypted/)
    process.env.PORTAL_ENCRYPTION_KEY = Buffer.alloc(32, 2).toString('base64')
    assert.throws(() => decryptPortalEmailSecret(encrypted), /could not be decrypted/)
  } finally {
    if (originalRoot === undefined) {
      delete process.env.PORTAL_ENCRYPTION_KEY
    } else {
      process.env.PORTAL_ENCRYPTION_KEY = originalRoot
    }
    if (originalEmail === undefined) {
      delete process.env.PORTAL_EMAIL_ENCRYPTION_KEY
    } else {
      process.env.PORTAL_EMAIL_ENCRYPTION_KEY = originalEmail
    }
  }
})

test('portal template requires body and rejects undeclared placeholders', () => {
  assert.doesNotThrow(() => validatePortalEmailTemplate('<title>{{subject}}</title>{{body}}{{footer}}'))
  assert.throws(() => validatePortalEmailTemplate('{{subject}}'), /must contain {{body}}/)
  assert.throws(() => validatePortalEmailTemplate('{{body}}{{unknown}}'), /Unknown template placeholder/)
})

test('saving an email credential reports missing or invalid encryption configuration without exposing the API key', () => {
  const originalRoot = process.env.PORTAL_ENCRYPTION_KEY
  const originalEmail = process.env.PORTAL_EMAIL_ENCRYPTION_KEY
  const apiKey = 're_private-provider-key'
  try {
    delete process.env.PORTAL_EMAIL_ENCRYPTION_KEY
    for (const root of [undefined, 'invalid-private-root']) {
      if (root === undefined) {
        delete process.env.PORTAL_ENCRYPTION_KEY
      } else {
        process.env.PORTAL_ENCRYPTION_KEY = root
      }
      assert.throws(
        () => encryptPortalEmailSecret(apiKey),
        (error: unknown) => {
          const response = error as { statusCode: number; data: { code: string; message: string } }
          assert.equal(response.statusCode, 503)
          assert.equal(response.data.code, 'EMAIL_ENCRYPTION_CONFIGURATION')
          assert.match(response.data.message, /PORTAL_ENCRYPTION_KEY/)
          assert.doesNotMatch(JSON.stringify(response), /re_private-provider-key|invalid-private-root/)
          return true
        }
      )
    }
    process.env.PORTAL_EMAIL_ENCRYPTION_KEY = 'retained-legacy-email-key'
    assert.equal(decryptPortalEmailSecret(encryptPortalEmailSecret(apiKey)), apiKey)
  } finally {
    for (const [name, value] of [
      ['PORTAL_ENCRYPTION_KEY', originalRoot],
      ['PORTAL_EMAIL_ENCRYPTION_KEY', originalEmail]
    ] as const) {
      if (value === undefined) {
        Reflect.deleteProperty(process.env, name)
      } else {
        process.env[name] = value
      }
    }
  }
})

test('message text accepts only placeholders declared by its module', () => {
  const definition = coreFeature.emails!.find((email) => email.id === 'sign-in')!
  assert.doesNotThrow(() => validatePortalEmailText(definition, definition.defaults.en))
  assert.throws(
    () => validatePortalEmailText(definition, { ...definition.defaults.en, body: '{{organization_name}}' }),
    /Unknown sign-in placeholder/
  )
})
