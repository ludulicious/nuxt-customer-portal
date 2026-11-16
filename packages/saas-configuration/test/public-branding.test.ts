import assert from 'node:assert/strict'
import test from 'node:test'
import { defaultPortalSettings, portalBrandImageFields } from '../shared/settings'
import { publicBranding } from '../server/utils/public-branding'

test('public branding uses versioned image references for every asset without changing stored settings', () => {
  const branding = defaultPortalSettings().branding
  for (const field of portalBrandImageFields) {
    branding[field] = 'data:image/png;base64,' + 'A'.repeat(300_000)
  }
  const original = JSON.stringify(branding)
  const display = publicBranding(branding, 'https://portal.example.test')
  assert.ok(JSON.stringify(display).length < 2000)
  for (const field of portalBrandImageFields) {
    assert.match(
      display[field],
      new RegExp(`^https://portal.example.test/api/portal/public/images/${field}\\?v=[a-f0-9]{24}$`)
    )
  }
  assert.equal(display.portalName, branding.portalName)
  assert.equal(JSON.stringify(branding), original)
  branding.logoLight += 'A'
  assert.notEqual(publicBranding(branding).logoLight, display.logoLight)
  branding.logoDark = ''
  assert.equal(publicBranding(branding).logoDark, '')
})
