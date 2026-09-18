import assert from 'node:assert/strict'
import test from 'node:test'
import {
  activeAppearancePreset,
  appearanceVariables,
  appearanceStylesheet,
  applyAppearancePreset,
  portalAppearanceSchema
} from '../shared/appearance'
import { defaultPortalSettings, portalSettingsSchema } from '../shared/settings'

test('stored legacy appearance gains defaults without changing its brand', () => {
  const settings = defaultPortalSettings()
  const legacy = { theme: 'brutal', colorMode: 'dark-only', primaryLight: '#123456', primaryDark: '#abcdef' }
  const parsed = portalSettingsSchema.parse({ ...settings, appearance: legacy })
  assert.equal(parsed.appearance.headingFont, 'theme')
  assert.equal(parsed.appearance.headerBranding, 'mark-name')
  assert.equal(parsed.appearance.primaryLight, legacy.primaryLight)
  assert.equal(parsed.appearance.backgroundDark, '')
})

test('editorial preset is complete, preserves mode policy and resets overrides predictably', () => {
  const current = { ...defaultPortalSettings().appearance, colorMode: 'dark-only' as const }
  const preset = applyAppearancePreset(current, 'soft-editorial')
  assert.equal(preset.colorMode, 'dark-only')
  assert.equal(preset.headingFont, 'playfair')
  assert.equal(preset.bodyFont, 'lato')
  assert.equal(preset.headerBranding, 'full-logo')
  assert.equal(activeAppearancePreset(preset), 'soft-editorial')
  assert.equal(portalAppearanceSchema.safeParse(preset).success, true)
  const reset = applyAppearancePreset(preset, 'business')
  assert.equal(reset.backgroundLight, '')
  assert.equal(reset.headingFont, 'theme')
  assert.equal(reset.primaryLight, '#ea580c')
  assert.equal(activeAppearancePreset(reset), 'business')
})

test('preset identity clears after customization and applying presets preserves the stored theme', () => {
  const legacyTheme = { ...defaultPortalSettings().appearance, theme: 'brutal' as const }
  const preset = applyAppearancePreset(legacyTheme, 'soft-editorial')
  assert.equal(preset.theme, 'brutal')
  assert.equal(activeAppearancePreset({ ...preset, surfaceLight: '#fefefe' }), null)
})

test('mode-specific brand colors cover navigation, surfaces and button foregrounds', () => {
  const appearance = applyAppearancePreset(defaultPortalSettings().appearance, 'soft-editorial')
  const light = appearanceVariables(appearance, false)
  const dark = appearanceVariables(appearance, true)
  assert.equal(light['--ui-primary'], '#543178')
  assert.equal(dark['--ui-primary'], '#e4d5ff')
  assert.equal(light['--portal-on-primary'], '#ffffff')
  assert.equal(dark['--portal-on-primary'], '#000000')
  assert.equal(light['--ui-bg'], '#f9f5fa')
  assert.equal(dark['--ui-bg'], '#211529')
  assert.equal(dark['--portal-surface'], '#302238')
  assert.equal(dark['--portal-surface-ink'], '#ffffff')
  assert.ok(light['--ui-color-primary-400'])
  assert.ok(dark['--ui-color-primary-600'])
  assert.match(appearanceStylesheet(appearance), /html:root.dark/)
})

test('styles reject CSS injection and unsupported font names', () => {
  const appearance = defaultPortalSettings().appearance
  for (const change of [
    { primaryLight: '#fff' },
    { backgroundDark: 'red;}</style><script>' },
    { bodyFont: 'url(https://example.com)' }
  ]) {
    assert.equal(portalAppearanceSchema.safeParse({ ...appearance, ...change }).success, false)
    assert.throws(() => appearanceStylesheet({ ...appearance, ...change } as typeof appearance))
  }
})

test('default appearance does not override theme surfaces or typography', () => {
  const vars = appearanceVariables(defaultPortalSettings().appearance, false)
  assert.equal(vars['--ui-bg'], undefined)
  assert.equal(vars['--font-sans'], undefined)
  assert.equal(vars['--ui-radius'], undefined)
})

test('light-only surface overrides cannot leak into the dark theme', () => {
  const appearance = { ...defaultPortalSettings().appearance, backgroundLight: '#ffffff', surfaceLight: '#ffffff' }
  const css = appearanceStylesheet(appearance)
  assert.match(css, /^html:root:not\(\.dark\)/)
  assert.equal(appearanceVariables(appearance, true)['--ui-bg'], undefined)
  assert.equal(appearanceVariables(appearance, true)['--portal-surface'], undefined)
})
