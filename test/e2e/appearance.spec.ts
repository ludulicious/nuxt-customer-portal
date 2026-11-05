import { readFileSync, realpathSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { runInNewContext } from 'node:vm'
import { test, expect, type Page } from '@playwright/test'
import {
  appearanceStylesheet,
  appearanceVariables,
  applyAppearancePreset,
  hasCustomAppearanceSurfaces
} from '../../packages/saas-configuration/shared/appearance'
import { defaultPortalSettings } from '../../packages/saas-configuration/shared/settings'

const root = resolve(import.meta.dirname, '../..')
const uiDirectory = dirname(realpathSync(resolve(root, 'packages/ui/node_modules/@nuxt/ui/package.json')))
const uiRequire = createRequire(resolve(uiDirectory, 'package.json'))
const { compile } = uiRequire('tailwindcss')
const paletteSource = readFileSync(resolve(uiDirectory, 'dist/runtime/plugins/colors.js'), 'utf8')
const palette = runInNewContext(
  `${paletteSource.slice(0, paletteSource.indexOf('export default')).replace(/^import .*\n/gm, '')}\n({generateShades, generateColor})`,
  { colors: uiRequire('tailwindcss/colors') }
)
const shades = Object.entries({ primary: 'orange', secondary: 'blue', neutral: 'slate' })
  .map(([key, color]) => palette.generateShades(key, color))
  .join(';')
const colors = (shade: number) => ['primary', 'secondary'].map((key) => palette.generateColor(key, shade)).join(';')
const paletteCss = `@layer theme { :root {${shades}} :root,.light {${colors(500)}} .dark {${colors(400)}} }`
const candidates = [
  'bg-default',
  'text-default',
  'border',
  'border-default',
  'rounded-md',
  'ring',
  'ring-default',
  'bg-primary',
  'hover:bg-primary/75',
  'text-inverted',
  'focus-visible:ring-primary',
  'data-highlighted:bg-elevated',
  'text-primary',
  'bg-primary/10',
  'bg-inverted/50'
]
const appearance = defaultPortalSettings().appearance
let nativeCss = ''
let portalCss = ''

test.beforeAll(async () => {
  const loadStylesheet = async (id: string, base: string) => {
    const path =
      id === '#build/ui.css'
        ? resolve(root, 'apps/saas-portal/.nuxt/ui.css')
        : id === '@nuxt/ui'
          ? resolve(uiDirectory, 'dist/runtime/index.css')
          : id === 'tailwindcss'
            ? uiRequire.resolve('tailwindcss/index.css')
            : resolve(base, id)
    return { path, base: dirname(path), content: readFileSync(path, 'utf8') }
  }
  const native = await compile(`@import 'tailwindcss'; @import '@nuxt/ui'; ${paletteCss}`, { loadStylesheet })
  nativeCss = native.build(candidates)
  const portal = await compile(
    `
    @import '${resolve(root, 'packages/ui/app/assets/css/surfaces.css')}';
    @import '${resolve(root, 'packages/saas-configuration/app/assets/css/main.css')}';
    ${paletteCss}`,
    { loadStylesheet }
  )
  portalCss = portal.build(candidates)
})

async function mount(page: Page, dark: boolean) {
  await page.setContent(`<style id="theme">${nativeCss}</style><style id="brand">${appearanceStylesheet(appearance)}</style>
    <main style="padding:24px">
      <button id="solid" class="rounded-md bg-primary hover:bg-primary/75 text-inverted">Save changes</button>
      <div id="card" class="portal-surface portal-appearance-card border border-default rounded-md bg-default text-default">Card</div>
      <input id="field" class="portal-field-surface rounded-md bg-default text-default ring ring-default focus-visible:ring-primary" value="Field">
      <div id="menu" class="portal-surface bg-default text-default border border-default">
        <div id="item" data-highlighted class="data-highlighted:bg-elevated">Menu item</div>
        <div id="active" class="text-primary bg-primary/10">Active item</div>
      </div>
      <div id="overlay" class="bg-inverted/50">Overlay</div>
      <div id="preview" class="portal-appearance-preview light" data-portal-theme="apex" data-portal-surfaces="theme">
        <div id="preview-card" class="portal-surface portal-appearance-card bg-default text-default border border-default">Preview</div>
      </div>
    </main>`)
  await page.evaluate((isDark) => {
    document.documentElement.className = isDark ? 'dark' : 'light'
    document.documentElement.dataset.portalTheme = 'apex'
    document.documentElement.dataset.portalSurfaces = 'theme'
  }, dark)
}

async function snapshot(page: Page) {
  return page.evaluate(() =>
    Object.fromEntries(
      ['solid', 'card', 'field', 'menu', 'item', 'active', 'overlay'].map((id) => {
        const style = getComputedStyle(document.getElementById(id)!)
        return [
          id,
          {
            background: style.backgroundColor,
            color: style.color,
            border: style.borderColor,
            radius: style.borderRadius,
            shadow: style.boxShadow,
            transform: style.transform,
            font: style.fontFamily
          }
        ]
      })
    )
  )
}

for (const dark of [false, true]) {
  test(`default portal matches installed Nuxt UI semantic styles in ${dark ? 'dark' : 'light'} mode`, async ({
    page
  }) => {
    await mount(page, dark)
    const native = await snapshot(page)
    await page.locator('#solid').hover()
    const nativeHover = (await snapshot(page)).solid
    await page.locator('#theme').evaluate((element, css) => {
      element.textContent = css
    }, portalCss)
    expect((await snapshot(page)).solid).toEqual(nativeHover)
    await page.mouse.move(0, 0)
    expect(await snapshot(page)).toEqual(native)
    expect(await page.locator('body').evaluate((element) => getComputedStyle(element).backgroundImage)).toBe('none')
  })

  test(`custom primary updates actions and selected menu colors without changing neutral surfaces in ${dark ? 'dark' : 'light'} mode`, async ({
    page
  }) => {
    await mount(page, dark)
    await page.locator('#theme').evaluate((element, css) => {
      element.textContent = css
    }, portalCss)
    const before = await snapshot(page)
    await page.locator('#brand').evaluate(
      (element, css) => {
        element.textContent = css
      },
      appearanceStylesheet({
        ...appearance,
        primaryLight: '#008877',
        primaryDark: '#77ddcc'
      })
    )
    const after = await snapshot(page)
    expect(after.solid!.background).not.toBe(before.solid!.background)
    expect(after.active!.background).not.toBe(before.active!.background)
    expect(after.active!.color).not.toBe(before.active!.color)
    for (const id of ['card', 'field', 'menu', 'item', 'overlay']) {
      expect(after[id]).toEqual(before[id])
    }
  })
}

test('keyboard focus rings follow the configured primary in both modes', async ({ page }) => {
  for (const dark of [false, true]) {
    await mount(page, dark)
    await page.locator('#theme').evaluate((element, css) => {
      element.textContent = css
    }, portalCss)
    await page.locator('#field').focus()
    const initial = (await snapshot(page)).field!.shadow
    await page.locator('#brand').evaluate(
      (element, css) => {
        element.textContent = css
      },
      appearanceStylesheet({
        ...appearance,
        primaryLight: '#008877',
        primaryDark: '#77ddcc'
      })
    )
    expect((await snapshot(page)).field!.shadow).not.toBe(initial)
  }
})

test('clearing overrides and switching to an uncustomized mode restores native surfaces', async ({ page }) => {
  await mount(page, true)
  const native = await snapshot(page)
  await page.locator('#theme').evaluate((element, css) => {
    element.textContent = css
  }, portalCss)
  const lightOnly = { ...appearance, backgroundLight: '#112233', surfaceLight: '#334455' }
  await page.locator('#brand').evaluate((element, css) => {
    element.textContent = css
  }, appearanceStylesheet(lightOnly))
  await page.evaluate(
    (custom) => {
      document.documentElement.dataset.portalSurfaces = custom ? 'custom' : 'theme'
    },
    hasCustomAppearanceSurfaces(lightOnly, true)
  )
  expect(await snapshot(page)).toEqual(native)
  await page.evaluate(() => {
    document.documentElement.className = 'light'
    document.documentElement.dataset.portalSurfaces = 'custom'
  })
  expect((await snapshot(page)).card!.background).toBe('rgb(51, 68, 85)')
  await page.locator('#brand').evaluate((element, css) => {
    element.textContent = css
  }, appearanceStylesheet(appearance))
  await page.evaluate(() => {
    document.documentElement.dataset.portalSurfaces = 'theme'
  })
  const reset = await snapshot(page)
  await page.locator('#theme').evaluate((element, css) => {
    element.textContent = css
  }, nativeCss)
  expect(reset).toEqual(await snapshot(page))
})

test('saved editorial surfaces are opt-in and cannot recolor the default live preview', async ({ page }) => {
  await mount(page, true)
  await page.locator('#theme').evaluate((element, css) => {
    element.textContent = css
  }, portalCss)
  const preview = () =>
    page.locator('#preview-card').evaluate((element) => {
      const style = getComputedStyle(element)
      return { background: style.backgroundColor, color: style.color, border: style.borderColor }
    })
  const initial = await preview()
  const preset = applyAppearancePreset(appearance, 'soft-editorial')
  await page.locator('#brand').evaluate((element, css) => {
    element.textContent = css
  }, appearanceStylesheet(preset))
  await page.evaluate(() => {
    document.documentElement.dataset.portalSurfaces = 'custom'
  })
  expect(await preview()).toEqual(initial)
  expect(await page.locator('#card').evaluate((element) => getComputedStyle(element).backgroundColor)).toBe(
    'rgb(48, 34, 56)'
  )
  await page.locator('#preview').evaluate(
    (element, variables) => {
      Object.assign((element as HTMLElement).style, variables)
      element.setAttribute('data-portal-surfaces', 'custom')
    },
    appearanceVariables(preset, false)
  )
  expect(await page.locator('#preview-card').evaluate((element) => getComputedStyle(element).backgroundColor)).toBe(
    'rgb(255, 255, 255)'
  )
  expect((await preview()).color).not.toBe(initial.color)
})

test('Brutal theme keeps its own fonts and surface palette', async ({ page }) => {
  await mount(page, false)
  await page.locator('#theme').evaluate((element, css) => {
    element.textContent = css
  }, portalCss)
  const native = await page.locator('body').evaluate((element) => getComputedStyle(element).backgroundColor)
  await page.evaluate(() => {
    document.documentElement.dataset.portalTheme = 'brutal'
  })
  const brutal = await page.locator('body').evaluate((element) => {
    const style = getComputedStyle(element)
    return { background: style.backgroundColor, font: style.fontFamily }
  })
  expect(brutal.background).not.toBe(native)
  expect(brutal.font).toContain('Geist')
})
