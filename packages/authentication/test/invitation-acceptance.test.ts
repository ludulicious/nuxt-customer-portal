import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

test('post-signup and verification flows use the portal invitation acceptance endpoint', async () => {
  const [signIn, verification] = await Promise.all([
    readFile(new URL('../app/components/AuthenticationSignInForm.vue', import.meta.url), 'utf8'),
    readFile(new URL('../app/pages/verify-email.vue', import.meta.url), 'utf8')
  ])
  for (const source of [signIn, verification]) {
    assert.match(source, /\/api\/organizations\/accept-invitation/)
    assert.doesNotMatch(source, /organization\.acceptInvitation/)
  }
  assert.match(signIn, /session\.data\?\.user\.email\?\.toLowerCase\(\) === invitation\.email\?\.toLowerCase\(\)/)
  assert.match(signIn, /finally \{[\s\S]+removeItem\('pendingInvitationId'\)/)
  assert.match(verification, /catch \(err\)[\s\S]+throw err/)
})

test('server acceptance marks the invitation accepted and reconciles an existing membership', async () => {
  const endpoint = await readFile(
    new URL('../../organizations/server/api/organizations/accept-invitation.post.ts', import.meta.url),
    'utf8'
  )
  assert.match(endpoint, /eq\(invitationTable\.status, 'pending'\)|invitation\.status !== 'pending'/)
  assert.match(endpoint, /if \(existingMember\)[\s\S]+status: 'accepted'/)
  assert.match(endpoint, /insert\(memberTable\)[\s\S]+status: 'accepted'/)
})

test('invitation signup uses the invitation as email proof and creates a signed-in session', async () => {
  const [signupPage, endpoint] = await Promise.all([
    readFile(new URL('../app/pages/signup.vue', import.meta.url), 'utf8'),
    readFile(new URL('../../organizations/server/api/organizations/invitation-signup.post.ts', import.meta.url), 'utf8')
  ])
  assert.match(signupPage, /\/api\/organizations\/invitation-signup/)
  assert.match(signupPage, /\/signup\?invitationId=/)
  assert.match(signupPage, /defaultValue: invitationInfo\.value\?\.email \|\| ''[\s\S]+readonly: true/)
  assert.match(signupPage, /accountSwitchOpen\.value = true/)
  assert.match(signupPage, /authClient\.signOut\(\)[\s\S]+window\.location\.assign\(route\.fullPath\)/)
  assert.match(endpoint, /invitation\.email\.trim\(\)\.toLowerCase\(\) !== email/)
  assert.match(endpoint, /emailVerified: true/)
  assert.match(endpoint, /invitation\.status === 'accepted'[\s\S]+acceptedAccount/)
  assert.match(signupPage, /authClient\.signIn\.email/)
  assert.match(signupPage, /setActiveOrganizationId\(result\.organization\.id\)/)
})
