import assert from 'node:assert/strict'
import test from 'node:test'
import { isSystemAdminEmail, parseSystemAdminEmails } from '../server/utils/admin-email-allowlist'

test('system administrator email allowlist is trimmed and case-insensitive', () => {
  const allowlist = parseSystemAdminEmails(' Admin@Example.com, owner@example.com ,')
  assert.equal(isSystemAdminEmail('admin@example.com', allowlist), true)
  assert.equal(isSystemAdminEmail(' OWNER@EXAMPLE.COM ', allowlist), true)
  assert.equal(isSystemAdminEmail('user@example.com', allowlist), false)
})
