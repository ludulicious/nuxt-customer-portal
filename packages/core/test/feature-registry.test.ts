import assert from 'node:assert/strict'
import test from 'node:test'
import { canManageOrganizationEmailCredential, isPortalActionAllowed, sortPortalDashboardWidgets, upsertPortalFeature } from '../shared/feature-registry'
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

test('dashboard contributions sort deterministically by area, order, and stable id', () => {
  const widgets = [
    { id: 'z', component: 'Z', area: 'main' as const, size: 'half' as const, order: 10 },
    { id: 'b', component: 'B', area: 'attention' as const, size: 'half' as const, order: 20 },
    { id: 'a', component: 'A', area: 'attention' as const, size: 'half' as const, order: 20 },
    { id: 'aside', component: 'Aside', area: 'aside' as const, size: 'full' as const, order: 1 }
  ]
  assert.deepEqual(sortPortalDashboardWidgets(widgets).map(widget => widget.id), ['a', 'b', 'z', 'aside'])
  assert.deepEqual(widgets.map(widget => widget.id), ['z', 'b', 'a', 'aside'])
})

test('feature policy honors organization roles without a system-admin bypass', () => {
  assert.equal(isPortalActionAllowed(feature.policy, 'member', 'read'), true)
  assert.equal(isPortalActionAllowed(feature.policy, 'member', 'manage'), false)
  assert.equal(isPortalActionAllowed(feature.policy, null, 'manage'), false)
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

test('organization email credentials are restricted to OWNER organization owners', () => {
  assert.equal(canManageOrganizationEmailCredential('owner'), true)
  assert.equal(canManageOrganizationEmailCredential('admin'), false)
  assert.equal(canManageOrganizationEmailCredential('member'), false)
  assert.equal(canManageOrganizationEmailCredential(null), false)
  assert.equal(canManageOrganizationEmailCredential('owner', 'CLIENT'), false)
})
