import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { apiKeySchema } from '../shared/api-key'

test('API key input accepts module-owned scopes and rejects malformed values', () => {
  assert.equal(
    apiKeySchema.safeParse({ name: 'Website', expiresAt: null, scopes: ['products.catalog:read'] }).success,
    true
  )
  assert.equal(apiKeySchema.safeParse({ name: 'Website', expiresAt: null, scopes: ['catalog'] }).success, false)
  assert.equal(apiKeySchema.safeParse({ name: 'Website', expiresAt: null, scopes: [] }).success, false)
})

test('English and Dutch API key translations stay aligned', () => {
  const en = JSON.parse(readFileSync(new URL('../i18n/locales/en.json', import.meta.url), 'utf8')).admin.apiKeys
  const nl = JSON.parse(readFileSync(new URL('../i18n/locales/nl.json', import.meta.url), 'utf8')).admin.apiKeys
  assert.deepEqual(Object.keys(en).sort(), Object.keys(nl).sort())
})
