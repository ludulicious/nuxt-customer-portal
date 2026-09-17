import assert from 'node:assert/strict'
import test from 'node:test'
import { isPublicInvitationRoute } from '../server/utils/public-invitation-route'

test('only invitation lookup and signup are public', () => {
  assert.equal(isPublicInvitationRoute('GET', '/api/organizations/get-invitation'), true)
  assert.equal(isPublicInvitationRoute('POST', '/api/organizations/invitation-signup'), true)
  assert.equal(isPublicInvitationRoute('POST', '/api/organizations/get-invitation'), false)
  assert.equal(isPublicInvitationRoute('GET', '/api/organizations/invitation-signup'), false)
  assert.equal(isPublicInvitationRoute('POST', '/api/organizations/accept-invitation'), false)
  assert.equal(isPublicInvitationRoute('GET', '/api/organizations/get-invitation/extra'), false)
})
