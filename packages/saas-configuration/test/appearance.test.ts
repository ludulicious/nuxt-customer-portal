import assert from 'node:assert/strict'
import test from 'node:test'
import {
  activeAppearancePreset,
  appearanceVariables,
  appearanceStylesheet,
  hasCustomAppearanceSurfaces,
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

test('changing primary colors updates the complete Nuxt UI palette in each mode without recoloring neutral roles', () => {
  const appearance = { ...defaultPortalSettings().appearance, primaryLight: '#008877', primaryDark: '#77ddcc' }
  for (const dark of [false, true]) {
    const vars = appearanceVariables(appearance, dark)
    const primary = dark ? appearance.primaryDark : appearance.primaryLight
    assert.equal(vars['--ui-primary'], primary)
    for (const shade of [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950]) {
      assert.equal(vars[`--ui-color-primary-${shade}`], vars[`--color-primary-${shade}`])
      assert.ok(vars[`--ui-color-primary-${shade}`]!.includes(primary))
    }
    for (const token of ['--ui-bg', '--ui-text', '--ui-border', '--ui-secondary', '--ui-success', '--ui-error']) {
      assert.equal(vars[token], undefined)
    }
  }
})

test('default CSS delegates semantic palettes and component states to Nuxt UI', async () => {
  const { readFile } = await import('node:fs/promises')
  const css = await readFile(new URL('../app/assets/css/main.css', import.meta.url), 'utf8')
  assert.match(css, /@import '@nuxt\/ui'/)
  assert.doesNotMatch(
    css,
    /--ui-(?:bg|text|border|primary|secondary|shadow)[\w-]*\s*:|--color-(?:primary|neutral)[\w-]*\s*:/
  )
  assert.doesNotMatch(css, /gradient\(|\[class\*=|!important|bg-primary:hover/)
  assert.match(css, /--portal-logo-surface: var\(--ui-primary\)/)
  const preview = await readFile(new URL('../app/assets/css/appearance.css', import.meta.url), 'utf8')
  assert.doesNotMatch(preview, /--ui-(?:bg|text|border|secondary):/)
  assert.doesNotMatch(preview, /#(?:0f172a|1e293b|f0f9ff|0a0f1a)/)
})

test('light-only surface overrides cannot leak into the dark theme', () => {
  const appearance = { ...defaultPortalSettings().appearance, backgroundLight: '#ffffff', surfaceLight: '#ffffff' }
  const css = appearanceStylesheet(appearance)
  assert.match(css, /^html:root:not\(\.dark\)/)
  assert.equal(appearanceVariables(appearance, true)['--ui-bg'], undefined)
  assert.equal(appearanceVariables(appearance, true)['--portal-surface'], undefined)
  assert.equal(hasCustomAppearanceSurfaces(appearance, false), true)
  assert.equal(hasCustomAppearanceSurfaces(appearance, true), false)
  const darkOnly = { ...defaultPortalSettings().appearance, backgroundDark: '#112233' }
  assert.equal(hasCustomAppearanceSurfaces(darkOnly, false), false)
  assert.equal(hasCustomAppearanceSurfaces(darkOnly, true), true)
})

test('soft appearance uses compact control rounding rather than pill-sized global radii', async () => {
  const appearance = applyAppearancePreset(defaultPortalSettings().appearance, 'soft-editorial')
  assert.equal(appearanceVariables(appearance, false)['--ui-radius'], '0.25rem')
  assert.equal(appearanceVariables(appearance, true)['--ui-radius'], '0.25rem')
  const { readFile } = await import('node:fs/promises')
  const css = await readFile(new URL('../app/assets/css/appearance.css', import.meta.url), 'utf8')
  assert.doesNotMatch(css, /border-radius: 999px/)
  assert.match(css, /border-radius: var\(--portal-control-radius\)/)
  assert.match(css, /border-radius: var\(--portal-panel-radius\)/)
})
