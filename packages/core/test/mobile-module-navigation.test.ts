import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const layoutUrl = new URL('../../ui/app/layouts/default.vue', import.meta.url)
const headerUrl = new URL('../../ui/app/components/AppHeader.vue', import.meta.url)

test('mobile navigation keeps module selection in the header and its menu in the hamburger', async () => {
  const [layout, header] = await Promise.all([
    readFile(layoutUrl, 'utf8'),
    readFile(headerUrl, 'utf8')
  ])

  assert.doesNotMatch(layout, /menu\.selectModule/)
  assert.doesNotMatch(layout, /menu\.openModuleMenu/)
  assert.match(header, /:aria-label="t\('menu\.selectModule'\)"/)
  assert.match(header, /:items="moduleSwitchItems"/)
  assert.match(header, /<template #body>/)
  assert.match(header, /menu\.activeModuleNavigation/)
  assert.match(header, /:items="activeModuleMenuItems"/)
  assert.match(layout, /:items="activeModuleMenuItems"/)
  assert.match(layout, /:min-size="18"/)
  assert.match(layout, /data-\[collapsed=true\]:min-w-0/)
})
