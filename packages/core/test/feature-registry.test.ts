import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import {
  canViewOrganizationDirectory,
  isPortalActionAllowed,
  mergePortalModuleMenuContributions,
  sortPortalDashboardWidgets,
  upsertPortalFeature
} from '../shared/feature-registry'
import { getActiveOrganizationId } from '../shared/portal-session'
import type { PortalFeatureDefinition } from '../shared/types/feature'
import { coreFeature } from '../shared/core-feature'

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

test('core email definitions have unique ids, localized defaults, and declared placeholders', () => {
  const emails = coreFeature.emails ?? []
  assert.equal(new Set(emails.map((email) => email.id)).size, emails.length)
  for (const email of emails) {
    assert.ok(email.defaults.en.subject)
    assert.ok(email.defaults.en.body)
    assert.ok(email.defaults.nl.subject)
    assert.ok(email.defaults.nl.body)
    const allowed = new Set([...email.placeholders.map((placeholder) => placeholder.key), 'brand_name'])
    for (const locale of ['en', 'nl'] as const) {
      const placeholders = Object.values(email.defaults[locale]).flatMap((value) =>
        [...String(value).matchAll(/{{\s*([a-z0-9_]+)\s*}}/gi)].map((match) => match[1])
      )
      assert.ok(placeholders.every((placeholder) => allowed.has(String(placeholder))))
    }
  }
})

test('dashboard contributions sort deterministically by area, order, and stable id', () => {
  const widgets = [
    { id: 'z', component: 'Z', area: 'main' as const, size: 'half' as const, order: 10 },
    { id: 'b', component: 'B', area: 'attention' as const, size: 'half' as const, order: 20 },
    { id: 'a', component: 'A', area: 'attention' as const, size: 'half' as const, order: 20 },
    { id: 'aside', component: 'Aside', area: 'aside' as const, size: 'full' as const, order: 1 }
  ]
  assert.deepEqual(
    sortPortalDashboardWidgets(widgets).map((widget) => widget.id),
    ['a', 'b', 'z', 'aside']
  )
  assert.deepEqual(
    widgets.map((widget) => widget.id),
    ['z', 'b', 'a', 'aside']
  )
})

test('features can contribute menu items to an existing module', () => {
  const modules = [
    {
      id: 'admin',
      labelKey: 'admin',
      to: '/admin',
      routePrefixes: ['/admin'],
      audiences: ['admin' as const],
      menuItems: [{ id: 'users', labelKey: 'users', to: '/admin/users', audiences: ['admin' as const] }]
    }
  ]
  const result = mergePortalModuleMenuContributions(modules, [
    {
      moduleId: 'admin',
      item: { id: 'portal-settings', labelKey: 'portalSettings', to: '/admin/portal-settings', audiences: ['admin'] }
    }
  ])
  assert.deepEqual(
    result[0]?.menuItems?.map((item) => item.id),
    ['users', 'portal-settings']
  )
})

test('feature policy honors organization roles without a system-admin bypass', () => {
  assert.equal(isPortalActionAllowed(feature.policy, 'member', 'read'), true)
  assert.equal(isPortalActionAllowed(feature.policy, 'member', 'manage'), false)
  assert.equal(isPortalActionAllowed(feature.policy, null, 'manage'), false)
})

test('active organization supports both Better Auth session shapes', () => {
  const user = { id: 'user-1' }
  assert.equal(
    getActiveOrganizationId({
      user,
      session: { activeOrganizationId: 'nested-organization' }
    }),
    'nested-organization'
  )
  assert.equal(
    getActiveOrganizationId({
      user,
      activeOrganizationId: 'top-level-organization'
    }),
    'top-level-organization'
  )
})

test('organization member and invitation directories are restricted to owners and admins', () => {
  assert.equal(canViewOrganizationDirectory('owner'), true)
  assert.equal(canViewOrganizationDirectory('admin'), true)
  assert.equal(canViewOrganizationDirectory('member'), false)
  assert.equal(canViewOrganizationDirectory(null), false)
})

test('provider organization migration preserves the immutable owner-type migration', async () => {
  const [legacy, provider] = await Promise.all([
    readFile(new URL('../migrations/0001_organization_types.sql', import.meta.url), 'utf8'),
    readFile(new URL('../migrations/0004_provider_organization_type.sql', import.meta.url), 'utf8')
  ])

  assert.match(legacy, /'OWNER', 'CLIENT'/)
  assert.match(provider, /SET "organization_type" = 'PROVIDER'/)
  assert.match(provider, /WHERE "organization_type" = 'OWNER'/)
  assert.match(provider, /CHECK \("organization_type" IN \('PROVIDER', 'CLIENT'\)\)/)
  assert.match(provider, /organization_single_provider_uidx/)
})

test('central email migration creates singleton settings without dropping legacy credentials', async () => {
  const migration = await readFile(new URL('../migrations/0005_portal_email_settings.sql', import.meta.url), 'utf8')
  assert.doesNotMatch(migration, /DROP TABLE/)
  assert.match(migration, /CREATE TABLE "portal_email_settings"/)
  assert.match(migration, /CHECK \("id" = true\)/)
  assert.match(migration, /encrypted_api_key/)
})
