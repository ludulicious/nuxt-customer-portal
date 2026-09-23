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
    if (originalRoot === undefined) delete process.env.PORTAL_ENCRYPTION_KEY
    else process.env.PORTAL_ENCRYPTION_KEY = originalRoot
    if (originalEmail === undefined) delete process.env.PORTAL_EMAIL_ENCRYPTION_KEY
    else process.env.PORTAL_EMAIL_ENCRYPTION_KEY = originalEmail
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
