import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { getClientAvatar } from '../shared/client-avatar'

const person = {
  clientType: 'person' as const,
  logo: 'company-logo.png',
  metadata: JSON.stringify({ avatarLogo: 'organization-avatar.png' })
}

test('personal client avatars prefer the account owner image over organization logos', () => {
  assert.equal(
    getClientAvatar(person, [
      { role: 'member', image: 'other-person.png' },
      { role: 'owner', image: 'profile.png' }
    ]),
    'profile.png'
  )
})

test('personal clients without a profile image retain logo and initials fallbacks', () => {
  for (const members of [[], [{ role: 'owner', image: null }], [{ role: 'owner', image: '' }]]) {
    assert.equal(getClientAvatar(person, members), 'organization-avatar.png')
    assert.equal(getClientAvatar({ ...person, metadata: null }, members), 'company-logo.png')
    assert.equal(getClientAvatar({ ...person, metadata: null, logo: null }, members), undefined)
  }
})

test('another member image is never used as the personal client avatar', () => {
  assert.equal(getClientAvatar(person, [{ role: 'admin', image: 'admin.png' }]), 'organization-avatar.png')
  assert.equal(
    getClientAvatar(person, [
      { role: 'member', image: 'member.png' },
      { role: 'owner', image: null }
    ]),
    'organization-avatar.png'
  )
})

test('organization clients keep their logo rather than a member profile image', () => {
  const members = [{ role: 'owner', image: 'profile.png' }]
  assert.equal(getClientAvatar({ ...person, clientType: 'organization' }, members), 'organization-avatar.png')
  assert.equal(
    getClientAvatar({ ...person, clientType: 'organization', metadata: 'invalid' }, members),
    'company-logo.png'
  )
})

test('client list and detail views consume the centrally resolved avatar', async () => {
  const repository = await readFile(new URL('../server/utils/client-repository.ts', import.meta.url), 'utf8')
  assert.match(repository, /avatarLogo: getClientAvatar\(row, clientMembers\) \?\? null/)
  assert.match(repository, /items: await hydrateClients\(rows\)/)
  assert.match(repository, /return \(await hydrateClients\(rows\)\)\[0\]/)

  for (const path of ['../app/pages/clients/index.vue', '../app/components/ClientsClientDetail.vue']) {
    const source = await readFile(new URL(path, import.meta.url), 'utf8')
    assert.match(source, /<UAvatar :src="client.avatarLogo \|\| client.logo \|\| undefined"/)
  }
})
