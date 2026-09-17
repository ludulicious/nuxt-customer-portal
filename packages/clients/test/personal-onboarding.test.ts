import assert from 'node:assert/strict'
import test from 'node:test'
import { needsPersonalOnboarding } from '../shared/personal-onboarding'

test('verified users without memberships recover into personal onboarding', () => {
  const eligible = { enabled: true, emailVerified: true, membershipCount: 0, hasPendingInvitation: false }
  assert.equal(needsPersonalOnboarding(eligible), true)
  for (const change of [
    { enabled: false },
    { emailVerified: false },
    { membershipCount: 1 },
    { hasPendingInvitation: true }
  ]) {
    assert.equal(needsPersonalOnboarding({ ...eligible, ...change }), false)
  }
})
