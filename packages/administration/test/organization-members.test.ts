import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { linkOrganizationMemberSchema } from '../server/utils/organization-member-validation'

test('conditionally mounted organization member modals load in setup', async () => {
  const [linkModal, inviteModal] = await Promise.all([
    readFile(new URL('../app/components/admin/LinkOrganizationMemberModal.vue', import.meta.url), 'utf8'),
    readFile(new URL('../app/components/admin/InviteMemberModal.vue', import.meta.url), 'utf8')
  ])

  assert.match(linkModal, /await loadUsers\(\)/)
  assert.doesNotMatch(linkModal, /watch\(\s*open/)
  assert.match(inviteModal, /const members = await \$fetch/)
  assert.doesNotMatch(inviteModal, /watch\(\s*open/)
})

test('linking an existing user requires a user and supported organization role', () => {
  assert.deepEqual(linkOrganizationMemberSchema.parse({ userId: ' user-1 ', role: 'admin' }), {
    userId: 'user-1',
    role: 'admin'
  })
  assert.equal(linkOrganizationMemberSchema.safeParse({ userId: '', role: 'member' }).success, false)
  assert.equal(linkOrganizationMemberSchema.safeParse({ userId: 'user-1', role: 'user' }).success, false)
})
