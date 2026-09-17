import assert from 'node:assert/strict'
import test from 'node:test'
import { socialAuthProviderEnabled } from '../shared/social-auth'

test('social authentication requires an explicit opt-in and both credentials', () => {
  assert.equal(socialAuthProviderEnabled(undefined, 'client-id', 'client-secret'), false)
  assert.equal(socialAuthProviderEnabled('false', 'client-id', 'client-secret'), false)
  assert.equal(socialAuthProviderEnabled('true', undefined, 'client-secret'), false)
  assert.equal(socialAuthProviderEnabled('true', 'client-id', undefined), false)
  assert.equal(socialAuthProviderEnabled('true', ' ', 'client-secret'), false)
  assert.equal(socialAuthProviderEnabled('true', 'client-id', ' '), false)
  assert.equal(socialAuthProviderEnabled('true', 'client-id', 'client-secret'), true)
})
