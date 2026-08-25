import assert from 'node:assert/strict'
import test from 'node:test'
import {
  decryptPortalEmailSecret,
  encryptPortalEmailSecret,
  validatePortalEmailTemplate,
  validatePortalEmailText
} from '../server/utils/portal-email'
import { coreFeature } from '../shared/core-feature'

test('portal email credentials are encrypted, authenticated, and key-bound', () => {
  const original = process.env.PORTAL_EMAIL_ENCRYPTION_KEY
  try {
    process.env.PORTAL_EMAIL_ENCRYPTION_KEY = 'test-encryption-key-one'
    const encrypted = encryptPortalEmailSecret('re_secret')
    assert.notEqual(encrypted, 're_secret')
    assert.equal(decryptPortalEmailSecret(encrypted), 're_secret')
    assert.throws(() => decryptPortalEmailSecret(`${encrypted.slice(0, -1)}x`), /could not be decrypted/)
    process.env.PORTAL_EMAIL_ENCRYPTION_KEY = 'test-encryption-key-two'
    assert.throws(() => decryptPortalEmailSecret(encrypted), /could not be decrypted/)
  } finally {
    if (original === undefined) {
      delete process.env.PORTAL_EMAIL_ENCRYPTION_KEY
    } else {
      process.env.PORTAL_EMAIL_ENCRYPTION_KEY = original
    }
  }
})

test('portal template requires body and rejects undeclared placeholders', () => {
  assert.doesNotThrow(() => validatePortalEmailTemplate('<title>{{subject}}</title>{{body}}{{footer}}'))
  assert.throws(() => validatePortalEmailTemplate('{{subject}}'), /must contain {{body}}/)
  assert.throws(() => validatePortalEmailTemplate('{{body}}{{unknown}}'), /Unknown template placeholder/)
})

test('message text accepts only placeholders declared by its module', () => {
  const definition = coreFeature.emails!.find((email) => email.id === 'sign-in')!
  assert.doesNotThrow(() => validatePortalEmailText(definition, definition.defaults.en))
  assert.throws(
    () => validatePortalEmailText(definition, { ...definition.defaults.en, body: '{{organization_name}}' }),
    /Unknown sign-in placeholder/
  )
})
