import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { test, expect, type Page } from '@playwright/test'
import ts from 'typescript'

const require = createRequire(new URL('../../packages/invoices/package.json', import.meta.url))

const { parse, compileScript } = require('vue/compiler-sfc') as typeof import('vue/compiler-sfc')

const source = readFileSync(
  new URL('../../packages/invoices/app/components/InvoicesInvoiceLinesEditor.vue', import.meta.url),
  'utf8'
)
const { descriptor } = parse(source)
const component = compileScript(descriptor, { id: 'invoice-lines-test', inlineTemplate: true }).content
const transpile = (code: string) =>
  ts.transpileModule(code.replaceAll('import.meta.client', 'true'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
  }).outputText
const modules = Object.fromEntries(
  [
    ['@nuxt-customer-portal/core/app/composables/useDragOrder', 'packages/core/app/composables/useDragOrder.ts'],
    ['@nuxt-customer-portal/invoices/shared/money', 'packages/invoices/shared/money.ts'],
    ['@nuxt-customer-portal/invoices/shared/invoice-copy', 'packages/invoices/shared/invoice-copy.ts'],
    ['@nuxt-customer-portal/invoices/shared/invoice-line-edit', 'packages/invoices/shared/invoice-line-edit.ts']
  ].map(([id, path]) => [id, transpile(readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8'))])
)
const translations = JSON.parse(
  readFileSync(new URL('../../packages/invoices/i18n/locales/en.json', import.meta.url), 'utf8')
)

async function mount(page: Page, count = 3, defaultVatRateBasisPoints = 2100) {
  await page.setContent(`<style>
    body { font-family: sans-serif; margin: 20px; }
    #scroll { height: 580px; overflow-y: auto; }
    .relative { position: relative; }
    ol { padding: 0; margin: 0; list-style: none; }
    li { border: 1px solid #aaa; margin-bottom: 8px; padding: 8px; }
    li > div:first-child { display: flex; align-items: center; gap: 12px; }
    button { min-width: 36px; min-height: 36px; }
    button[aria-expanded] { flex: 1; text-align: left; }
    button[aria-expanded] span { display: block; }
    textarea { display: block; width: 95%; }
    .invoice-sort-move { transition: transform 160ms ease; }
  </style><div id="scroll"><div id="app"></div></div>`)
  await page.addScriptTag({ path: require.resolve('vue/dist/vue.global.js') })
  await page.addScriptTag({
    content: String.raw`
    Object.assign(window, Vue);
    const translations = ${JSON.stringify(translations)};
    window.useI18n = () => ({ locale: ref('en'), t: (key, values = {}) => {
      const value = key.split('.').reduce((item, part) => item?.[part], translations) || key;
      return value.replace(/\{(\w+)\}/g, (_, name) => values[name] ?? name);
    }});
    const sources = ${JSON.stringify({ ...modules, component: transpile(component) })};
    const cache = { vue: Vue };
    window.require = (id) => {
      if (cache[id]) return cache[id];
      if (!sources[id]) throw new Error('Unexpected module: ' + id);
      const exports = cache[id] = {};
      new Function('require', 'exports', sources[id])(window.require, exports);
      return exports;
    };
    window.invoiceLines = ref(Array.from({ length: ${count} }, (_, index) => ({
      id: 'line-' + index, description: 'Line ' + (index + 1), quantityMilli: 1000,
      unit: 'hour', unitPriceMinor: 5000 + index, vatRateBasisPoints: 2100,
      timeEntryIds: ['entry-' + index]
    })));
    const app = createApp({ setup: () => () => h(require('component').default, {
      currency: 'EUR', defaultVatRateBasisPoints: ${defaultVatRateBasisPoints}, modelValue: invoiceLines.value,
      'onUpdate:modelValue': (value) => { invoiceLines.value = value; }
    }) });
    app.component('UFormField', { setup: (_, { slots }) => () => h('div', slots.default?.()) });
    app.component('UIcon', { setup: () => () => h('span', { style: 'display:inline-block;width:20px;height:20px;background:#888' }) });
    app.component('UButton', { setup: (_, { attrs, slots }) => () => h('button', attrs, slots.default?.()) });
    for (const [name, tag] of [['UTextarea', 'textarea'], ['UInput', 'input'], ['UInputNumber', 'input']]) {
      app.component(name, { props: ['modelValue'], emits: ['update:modelValue'],
        setup: (props, { emit }) => () => h(tag, { value: props.modelValue,
          onInput: (event) => emit('update:modelValue', event.target.value) }) });
    }
    app.mount('#app');`
  })
  await expect(page.locator('[data-invoice-line]')).toHaveCount(count)
}

const order = (page: Page) =>
  page.evaluate(() =>
    (window as unknown as { invoiceLines: { value: Array<{ id: string }> } }).invoiceLines.value.map((line) => line.id)
  )

const waitForSortAnimation = (page: Page) =>
  expect
    .poll(() =>
      page
        .locator('[data-invoice-line]')
        .evaluateAll(
          (elements) =>
            elements
              .flatMap((element) => element.getAnimations())
              .filter((animation) => animation.playState === 'running').length
        )
    )
    .toBe(0)

test('dragging the actual handle previews and commits the media-library order', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await mount(page)
  const first = page.locator('[data-invoice-line="0"]')
  const last = page.locator('[data-invoice-line="2"]')
  const handle = await first.locator('[aria-keyshortcuts]').boundingBox()
  const target = await last.boundingBox()
  await page.mouse.move(handle!.x + handle!.width / 2, handle!.y + handle!.height / 2)
  await page.mouse.down()
  await page.mouse.move(target!.x + 80, target!.y + target!.height / 2, { steps: 12 })
  await page.mouse.move(target!.x + 81, target!.y + target!.height / 2)
  await page.mouse.move(target!.x + 82, target!.y + target!.height / 2)
  await expect(page.locator('[data-invoice-line]').last()).toHaveAttribute('data-invoice-line', '0')
  expect(await order(page)).toEqual(['line-0', 'line-1', 'line-2'])
  await waitForSortAnimation(page)
  await page.mouse.move(target!.x + 83, target!.y + target!.height / 2)
  await page.mouse.move(target!.x + 84, target!.y + target!.height / 2)
  await page.mouse.up()
  await expect.poll(() => order(page)).toEqual(['line-1', 'line-2', 'line-0'])
  expect(await page.getByRole('button', { name: /Move invoice line/ }).count()).toBe(0)
  expect(errors).toEqual([])
})

test('keyboard sorting retains handle focus and adding a line focuses its description', async ({ page }) => {
  await mount(page)
  const handle = page.locator('[data-invoice-line="0"] [aria-keyshortcuts]')
  await handle.focus()
  await page.keyboard.press('ArrowDown')
  expect(await order(page)).toEqual(['line-1', 'line-0', 'line-2'])
  await expect(handle).toBeFocused()
  await page.getByRole('button', { name: 'Add line', exact: true }).click()
  await expect(page.locator('textarea')).toHaveCount(1)
  await expect(page.locator('textarea')).toBeFocused()
})

test('cancelling a preview leaves the saved order unchanged', async ({ page }) => {
  await mount(page)
  const handle = await page.locator('[data-invoice-line="0"] [aria-keyshortcuts]').boundingBox()
  const target = await page.locator('[data-invoice-line="2"]').boundingBox()
  await page.mouse.move(handle!.x + 10, handle!.y + 10)
  await page.mouse.down()
  await page.mouse.move(target!.x + 80, target!.y + target!.height / 2, { steps: 12 })
  await page.mouse.move(target!.x + 81, target!.y + target!.height / 2)
  await page.mouse.move(target!.x + 82, target!.y + target!.height / 2)
  await expect(page.locator('[data-invoice-line]').last()).toHaveAttribute('data-invoice-line', '0')
  await page.keyboard.press('Escape')
  await page.mouse.up()
  await expect(page.locator('[data-invoice-line]').first()).toHaveAttribute('data-invoice-line', '0')
  expect(await order(page)).toEqual(['line-0', 'line-1', 'line-2'])
})

test('dragging near the scroll edge reveals later lines and commits the preview', async ({ page }) => {
  await mount(page, 24)
  const handle = await page.locator('[data-invoice-line="0"] [aria-keyshortcuts]').boundingBox()
  const scroll = await page.locator('#scroll').boundingBox()
  const edge = { x: scroll!.x + 80, y: scroll!.y + scroll!.height - 12 }
  await page.mouse.move(handle!.x + 10, handle!.y + 10)
  await page.mouse.down()
  await page.mouse.move(edge.x, edge.y, { steps: 12 })
  await page.mouse.move(edge.x + 1, edge.y)
  await expect.poll(() => page.locator('#scroll').evaluate((element) => element.scrollTop)).toBeGreaterThan(100)
  const middle = { x: edge.x + 2, y: scroll!.y + scroll!.height / 2 }
  await page.mouse.move(middle.x, middle.y)
  await page.mouse.move(middle.x + 1, middle.y)
  await expect
    .poll(() =>
      page
        .locator('[data-invoice-line]')
        .evaluateAll((elements) => elements.findIndex((element) => element.getAttribute('data-invoice-line') === '0'))
    )
    .toBeGreaterThan(3)
  await waitForSortAnimation(page)
  const target = page.locator('[data-invoice-line="0"]')
  await expect(target).toBeInViewport()
  const drop = await target.boundingBox()
  await page.mouse.move(drop!.x + 80, drop!.y + drop!.height / 2)
  await page.mouse.move(drop!.x + 81, drop!.y + drop!.height / 2)
  await page.mouse.up()
  await expect.poll(async () => (await order(page)).indexOf('line-0')).toBeGreaterThan(3)
  await expect(page.locator('[data-drag-preview]')).toHaveCount(0)
})

test('adding a draft line uses the workspace VAT default without changing existing rates', async ({ page }) => {
  await mount(page, 3, 900)
  await page.getByRole('button', { name: 'Add line', exact: true }).click()
  await expect(page.locator('textarea')).toBeFocused()
  const rates = await page.evaluate(() =>
    (window as unknown as { invoiceLines: { value: Array<{ vatRateBasisPoints: number }> } }).invoiceLines.value.map(
      (line) => line.vatRateBasisPoints
    )
  )
  expect(rates).toEqual([2100, 2100, 2100, 900])
})
