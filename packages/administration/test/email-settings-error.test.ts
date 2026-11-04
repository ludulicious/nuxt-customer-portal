import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { emailSettingsErrorMessage } from '../shared/email-settings-error'

test('provider save shows actionable server configuration feedback instead of only the HTTP status', () => {
  assert.equal(
    emailSettingsErrorMessage({
      data: {
        data: {
          code: 'EMAIL_ENCRYPTION_CONFIGURATION',
          message: 'Configure PORTAL_ENCRYPTION_KEY or PORTAL_EMAIL_ENCRYPTION_KEY'
        }
      }
    }),
    'Configure PORTAL_ENCRYPTION_KEY or PORTAL_EMAIL_ENCRYPTION_KEY'
  )
  const form = readFileSync(new URL('../app/components/admin/email/EmailProviderSection.vue', import.meta.url), 'utf8')
  assert.match(form, /description: emailSettingsErrorMessage\(error\)/)
})

test('unrecognized errors retain the normal error fallback', () => {
  assert.equal(emailSettingsErrorMessage(new Error('Network failed')), 'Error: Network failed')
  assert.equal(emailSettingsErrorMessage(null), 'null')
  assert.equal(
    emailSettingsErrorMessage({ data: { data: { code: 'UNKNOWN', message: 'private details' } } }),
    '[object Object]'
  )
})
