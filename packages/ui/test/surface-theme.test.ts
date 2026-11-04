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

test('all standard fields use Nuxt UI surface overrides and Tailwind rounding without replacing native sizes or padding', () => {
  for (const field of [
    ui.input,
    ui.textarea,
    ui.inputDate,
    ui.inputTime,
    ui.inputTags,
    ui.select,
    ui.selectMenu,
    ui.inputMenu
  ]) {
    assert.equal(field.slots.base, 'rounded-lg')
    assert.equal('size' in field.variants, false)
    for (const variant of ['outline', 'soft', 'subtle'] as const) {
      assert.match(field.variants.variant[variant], /portal-field-surface bg-\(--portal-surface\)/)
      assert.match(field.variants.variant[variant], /ring-accented/)
    }
  }
  assert.equal('size' in ui.inputNumber.variants, false)
  assert.equal('variants' in ui.button, false)
  assert.equal(ui.input.variants.variant.outline, ui.inputNumber.variants.variant.outline)
})

test('cards and teleported overlays establish the same surface context', () => {
  for (const panel of [ui.card, ui.pageCard]) {
    assert.match(panel.slots.root, /rounded-xl/)
    assert.match(panel.variants.variant.outline.root, /portal-surface bg-\(--portal-surface\)/)
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
    assert.match(content, /portal-surface bg-\(--portal-surface\)/)
  }
  assert.match(ui.select.slots.arrow, /fill-\(--portal-surface\)/)
})

test('neutral secondary actions remain transparent and selections retain brand tint', () => {
  const neutral = ui.button.compoundVariants.find(
    (variant) => variant.color === 'neutral' && variant.variant === 'outline'
  )
  assert.match(neutral!.class, /bg-transparent/)
  assert.match(neutral!.class, /disabled:bg-transparent/)
  assert.match(ui.select.slots.item, /data-\[state=checked\]:before:bg-primary\/10/)
  assert.match(ui.button.compoundVariants[0]!.class, /portal-on-primary/)
})

test('submenu hover matches the Clients primary ghost button without replacing active or disabled states', () => {
  const hover = ui.navigationMenu.compoundVariants.find((variant) => variant.active === false)!
  assert.equal(hover.disabled, false)
  assert.equal(hover.color, 'primary')
  assert.match(hover.class.link, /hover:before:bg-primary\/10 hover:text-primary/)
  assert.match(hover.class.childLink, /hover:before:bg-primary\/10 hover:text-primary/)
  const active = ui.navigationMenu.compoundVariants.find((variant) => variant.active === true)!
  assert.match(active.class.link, /before:bg-primary\/10 text-primary font-semibold/)
  assert.match(ui.navigationMenu.slots.link, /focus-visible:before:outline-primary/)
})

test('link buttons retain full color and stronger pressed backgrounds without underlines across semantic colors', () => {
  for (const color of ['primary', 'secondary', 'success', 'info', 'warning', 'error', 'neutral']) {
    const link = ui.button.compoundVariants.find((variant) => variant.color === color && variant.variant === 'link')!
    assert.ok(link, color)
    assert.doesNotMatch(link.class, /underline|decoration-/)
    assert.match(link.class, /hover:disabled:bg-transparent hover:aria-disabled:bg-transparent/)
    assert.doesNotMatch(link.class, /(?:hover|active):text-[\w-]+\/\d+/)
    if (color !== 'neutral') {
      assert.ok(link.class.includes(`hover:text-${color} active:text-${color}`))
      assert.ok(link.class.includes(`hover:bg-${color}/10 active:bg-${color}/20`))
    }
  }
})

test('standalone links retain native Nuxt UI interaction and focus styles', () => {
  assert.equal('link' in ui, false)
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
  assert.match(css, /--portal-surface: #1e293b/)
  assert.match(css, /\.portal-surface,\s*\.portal-field-surface\s*\{\s*--ui-bg: var\(--portal-surface\)/)
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
