import assert from 'node:assert/strict'
import test from 'node:test'
import { privateClientInvitationSchema } from '../shared/private-client-invitation'

const requestId = '0de0141a-67c2-49ca-8a11-625a5319ccbd'
test('private invitation requires a target and validates reusable request identity', () => {
  assert.equal(privateClientInvitationSchema.safeParse({ requestId, email: 'client@example.test' }).success, false)
  assert.equal(
    privateClientInvitationSchema.safeParse({ requestId: 'invalid', name: 'Client', email: 'client@example.test' })
      .success,
    false
  )
  assert.equal(privateClientInvitationSchema.safeParse({ requestId, name: 'Client', email: 'invalid' }).success, false)
  assert.equal(
    privateClientInvitationSchema.parse({ requestId, name: 'Client', email: ' CLIENT@EXAMPLE.TEST ' }).email,
    'client@example.test'
  )
  assert.equal(
    privateClientInvitationSchema.parse({ requestId, clientId: 'existing', email: 'client@example.test' }).clientId,
    'existing'
  )
})
