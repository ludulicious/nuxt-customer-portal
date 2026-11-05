import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const originalDefineAppConfig = Reflect.get(globalThis, 'defineAppConfig')
Reflect.set(globalThis, 'defineAppConfig', (config: unknown) => config)
const { default: appConfig } = await import('../app/app.config')
if (originalDefineAppConfig === undefined) {
  Reflect.deleteProperty(globalThis, 'defineAppConfig')
} else {
  Reflect.set(globalThis, 'defineAppConfig', originalDefineAppConfig)
}
const { ui } = appConfig

test('default fields retain native Nuxt UI variants, rounding, sizes and padding', () => {
  for (const field of [
    ui.input,
    ui.textarea,
    ui.inputNumber,
    ui.inputDate,
    ui.inputTime,
    ui.inputTags,
    ui.select,
    ui.selectMenu,
    ui.inputMenu
  ]) {
    assert.equal(field.slots.base, 'portal-field-surface')
    assert.equal('variants' in field, false)
    assert.doesNotMatch(JSON.stringify(field), /rounded-|bg-|ring-/)
  }
})

test('cards and overlays only add opt-in surface hooks without replacing native variants', () => {
  for (const panel of [ui.card, ui.pageCard]) {
    assert.equal(panel.slots.root, 'portal-surface')
    assert.equal('variants' in panel, false)
  }
  for (const content of [
    ui.select.slots.content,
    ui.selectMenu.slots.content,
    ui.inputMenu.slots.content,
    ui.dropdownMenu.slots.content,
    ui.modal.slots.content,
    ui.slideover.slots.content,
    ui.popover.slots.content,
    ui.toast.slots.root
  ]) {
    assert.equal(content, 'portal-surface')
  }
})

test('primary buttons retain brand contrast without overriding native hover, link or neutral states', () => {
  assert.equal(ui.button.compoundVariants.length, 1)
  const [primary] = ui.button.compoundVariants
  assert.equal(primary!.variant, 'solid')
  assert.equal(primary!.color, 'primary')
  assert.match(primary!.class, /portal-on-primary/)
  assert.doesNotMatch(primary!.class, /hover:|active:|bg-|rounded-/)
  assert.equal('tabs' in ui, false)
  assert.equal('link' in ui, false)
  assert.equal('compoundVariants' in ui.navigationMenu, false)
})

test('main menu buttons share the Clients hover tint even when their inactive color is neutral', async () => {
  const sidebar = await readFile(new URL('../app/components/PortalSidebarNavigation.vue', import.meta.url), 'utf8')
  assert.match(
    sidebar,
    /const mainMenuButtonUi = \{ base: 'hover:bg-primary\/10 hover:text-primary active:bg-primary\/10' \}/
  )
  assert.equal((sidebar.match(/<UButton\b/g) ?? []).length, 4)
  assert.equal((sidebar.match(/:ui="mainMenuButtonUi"/g) ?? []).length, 4)
})

test('surface tokens are provided by the UI layer in both modes and remain independent of the page canvas', async () => {
  const css = await readFile(new URL('../app/assets/css/surfaces.css', import.meta.url), 'utf8')
  const config = await readFile(new URL('../nuxt.config.ts', import.meta.url), 'utf8')
  assert.match(config, /app\/assets\/css\/surfaces.css/)
  const saasCss = await readFile(new URL('../../saas-configuration/app/assets/css/main.css', import.meta.url), 'utf8')
  assert.doesNotMatch(saasCss, /@import.*\.\.\/ui\//)
  assert.match(css, /--portal-surface: #ffffff/)
  assert.match(css, /:where\(:root.dark, .portal-appearance-preview.dark\)/)
  assert.match(css, /--portal-surface: var\(--ui-color-neutral-900\)/)
  assert.match(css, /\[data-portal-surfaces='custom'\]/)
  assert.match(css, /:not\(\.portal-appearance-preview\[data-portal-surfaces='theme'\] \*\)/)
  assert.doesNotMatch(css, /\.portal-surface,\s*\.portal-field-surface\s*\{/)
  assert.match(css, /--portal-control-border: color-mix/)
  assert.match(css, /--portal-control-radius: 0.5rem/)
  assert.match(css, /--portal-panel-radius: 0.75rem/)
})

test('Markdown fields use shared borders and focus states without overriding dropdown or link backgrounds', async () => {
  const editor = await readFile(new URL('../app/components/PortalMarkdownEditor.vue', import.meta.url), 'utf8')
  assert.match(editor, /portal-markdown-editor portal-field-surface w-full rounded-lg/)
  assert.match(editor, /border-\(--portal-control-border\) focus-within:ring-primary/)
  assert.match(editor, /border-error focus-within:ring-error/)
  assert.match(editor, /bg-inherit text-inherit/)
  assert.doesNotMatch(editor, /portal-appearance-input/)
})
