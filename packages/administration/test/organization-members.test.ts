import assert from 'node:assert/strict'
import test from 'node:test'
import { linkOrganizationMemberSchema } from '../server/utils/organization-member-validation'

test('linking an existing user requires a user and supported organization role', () => {
  assert.deepEqual(linkOrganizationMemberSchema.parse({ userId: ' user-1 ', role: 'admin' }), { userId: 'user-1', role: 'admin' })
  assert.equal(linkOrganizationMemberSchema.safeParse({ userId: '', role: 'member' }).success, false)
  assert.equal(linkOrganizationMemberSchema.safeParse({ userId: 'user-1', role: 'user' }).success, false)
})
