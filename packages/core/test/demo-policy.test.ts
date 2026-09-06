import assert from 'node:assert/strict'
import { test } from 'node:test'
import { isDemoRequestAllowed, demoMessage } from '../shared/demo-policy'

test('demo denies account and access mutations through every API family', () => {
  for (const path of [
    '/api/auth/sign-up/email',
    '/api/auth/change-password',
    '/api/auth/update-user',
    '/api/auth/admin/ban-user',
    '/api/auth/admin/unban-user',
    '/api/auth/admin/set-role',
    '/api/auth/admin/create-user',
    '/api/auth/admin/remove-user',
    '/api/auth/admin/impersonate-user',
    '/api/auth/organization/invite-member',
    '/api/auth/organization/update-member-role',
    '/api/profile',
    '/api/admin/users/demo-member/role',
    '/api/clients/demo-garden/members/x',
    '/api/clients/demo-garden/invitations',
    '/api/clients/demo-garden/modules/invoices',
    '/api/timesheets/client/x/reviewers',
    '/api/invoices/client/x/viewers',
    '/api/timesheets/admin/team/x',
    '/api/timesheets/admin/internal-approvals/x',
    '/api/organizations/accept-invitation',
    '/api/invoices/admin/invoices/x/email',
    '/api/admin/email/test',
    '/api/unknown-new-feature'
  ]) {
    for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) {
      assert.equal(isDemoRequestAllowed(method, path), false, `${method} ${path}`)
    }
  }
})

test('authentication callbacks cannot mutate accounts via GET or encoded paths', () => {
  for (const path of [
    '/api/auth/callback/github',
    '/api/auth/verify-email',
    '/api/auth/delete-user/callback',
    '/api/auth/%61dmin/ban-user',
    '/api/auth/../profile',
    '/api/auth/%'
  ]) {
    assert.equal(isDemoRequestAllowed('GET', path), false, path)
  }
})

test('business workflows and session context switching remain usable', () => {
  for (const [method, path] of [
    ['GET', '/api/auth/get-session'],
    ['GET', '/api/auth/organization/list-members'],
    ['POST', '/api/auth/organization/set-active'],
    ['POST', '/api/demo/switch'],
    ['POST', '/api/clients'],
    ['PATCH', '/api/clients/x'],
    ['DELETE', '/api/clients/x'],
    ['POST', '/api/service-requests'],
    ['PATCH', '/api/service-requests/x'],
    ['POST', '/api/timesheets/entries'],
    ['DELETE', '/api/timesheets/entries/x'],
    ['POST', '/api/timesheets/internal-approvals/x'],
    ['POST', '/api/timesheets/admin/approvals/x'],
    ['POST', '/api/invoices/admin/invoices/x/issue'],
    ['POST', '/api/invoices/admin/invoices/x/payments']
  ]) {
    assert.equal(isDemoRequestAllowed(method!, path!), true, `${method} ${path}`)
  }
  assert.equal(demoMessage('nl-NL'), 'Deze actie is niet beschikbaar in de demo. Er zijn geen wijzigingen toegepast.')
})
