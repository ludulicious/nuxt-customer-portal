import assert from 'node:assert/strict'
import test from 'node:test'
import { canManageOrganizationEmailCredential, isPortalActionAllowed, upsertPortalFeature } from '../shared/feature-registry'
import { getActiveOrganizationId } from '../shared/portal-session'
import type { PortalFeatureDefinition } from '../shared/types/feature'

const feature: PortalFeatureDefinition<'read' | 'manage'> = {
  id: 'example',
  policy: {
    owner: ['read', 'manage'],
    admin: ['read', 'manage'],
    member: ['read']
  }
}

test('feature registration is idempotent and replaces definitions by id', () => {
  assert.deepEqual(upsertPortalFeature([], feature), [feature])
  const replacement = { ...feature, navigation: [] }
  assert.deepEqual(upsertPortalFeature([feature], replacement), [replacement])
})

test('feature policy honors organization roles and system-admin bypass', () => {
  assert.equal(isPortalActionAllowed(feature.policy, 'member', 'read'), true)
  assert.equal(isPortalActionAllowed(feature.policy, 'member', 'manage'), false)
  assert.equal(isPortalActionAllowed(feature.policy, null, 'manage', true), true)
})

test('active organization supports both Better Auth session shapes', () => {
  const user = { id: 'user-1' }
  assert.equal(getActiveOrganizationId({
    user,
    session: { activeOrganizationId: 'nested-organization' }
  }), 'nested-organization')
  assert.equal(getActiveOrganizationId({
    user,
    activeOrganizationId: 'top-level-organization'
  }), 'top-level-organization')
})

test('organization email credentials are restricted to owners and system administrators', () => {
  assert.equal(canManageOrganizationEmailCredential('owner'), true)
  assert.equal(canManageOrganizationEmailCredential('admin'), false)
  assert.equal(canManageOrganizationEmailCredential('member'), false)
  assert.equal(canManageOrganizationEmailCredential(null), false)
  assert.equal(canManageOrganizationEmailCredential(null, true), true)
})
