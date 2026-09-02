import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { invitationChangeSchema } from '../../core/shared/invitation-validation'

test('invitation changes accept only supported roles or revocation', () => {
  for (const role of ['member', 'admin', 'owner']) {
    assert.equal(invitationChangeSchema.safeParse({ role }).success, true)
  }
  assert.equal(invitationChangeSchema.safeParse({ status: 'canceled' }).success, true)
  for (const input of [{ role: 'superadmin' }, { status: 'accepted' }, {}, { role: 'admin', status: 'canceled' }]) {
    assert.equal(invitationChangeSchema.safeParse(input).success, false)
  }
})

test('invitation mutations enforce organization and pending state atomically', async () => {
  const source = await readFile(new URL('../../core/server/utils/invitation-management.ts', import.meta.url), 'utf8')
  assert.match(source, /eq\(invitation\.organizationId, organizationId\)/)
  assert.match(source, /eq\(invitation\.id, invitationId\)/)
  assert.match(source, /eq\(invitation\.status, 'pending'\)/)
  assert.match(source, /gt\(invitation\.expiresAt, new Date\(\)\)/)
  assert.match(source, /statusCode: 409/)
  assert.doesNotMatch(source, /\.delete\(/)
})

test('client and user views share confirmed revocation and validated role editing', async () => {
  const read = (path: string) => readFile(new URL(path, import.meta.url), 'utf8')
  const [actions, client, users, pending] = await Promise.all([
    read('../../ui/app/components/InvitationActions.vue'),
    read('../app/components/ClientsClientDetail.vue'),
    read('../../administration/app/pages/admin/users/index.vue'),
    read('../../administration/app/components/admin/PendingInvitations.vue')
  ])
  assert.match(actions, /:schema="invitationRoleSchema"/)
  assert.match(actions, /<ConfirmationModal/)
  assert.match(actions, /@confirm="revoke"/)
  assert.match(client, /<InvitationActions/)
  assert.match(users, /<AdminPendingInvitations/)
  assert.match(pending, /<InvitationActions/)
})

test('invitation management translations have matching English and Dutch keys', async () => {
  const load = async (locale: string) =>
    JSON.parse(await readFile(new URL(`../../core/i18n/locales/${locale}.json`, import.meta.url), 'utf8'))
      .invitationManagement
  assert.deepEqual(Object.keys(await load('en')).sort(), Object.keys(await load('nl')).sort())
})
