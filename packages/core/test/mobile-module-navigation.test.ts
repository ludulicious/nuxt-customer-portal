import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const layoutUrl = new URL('../../ui/app/layouts/default.vue', import.meta.url)
const headerUrl = new URL('../../ui/app/components/AppHeader.vue', import.meta.url)
const moduleNavigationUrl = new URL('../../ui/app/composables/useModuleNavigation.ts', import.meta.url)

test('mobile navigation combines collapsible modules and their subitems in the hamburger', async () => {
  const [layout, header, moduleNavigation] = await Promise.all([
    readFile(layoutUrl, 'utf8'),
    readFile(headerUrl, 'utf8'),
    readFile(moduleNavigationUrl, 'utf8')
  ])

  assert.doesNotMatch(layout, /menu\.selectModule/)
  assert.doesNotMatch(layout, /menu\.openModuleMenu/)
  assert.doesNotMatch(header, /moduleSwitchItems/)
  assert.doesNotMatch(header, /menu\.selectModule/)
  assert.match(header, /<template #body>/)
  assert.match(header, /menu\.moduleNavigation/)
  assert.match(header, /v-for="module in moduleNavigationGroups"/)
  assert.match(header, /v-if="module\.menuItems\.length > 1"/)
  assert.match(header, /:to="module\.menuItems\[0\]\?\.to \?\? module\.to"/)
  assert.match(header, /module\.menuItems\[0\]\?\.label \?\? module\.label/)
  assert.match(header, /@click="toggleMobileModule\(module\.id\)"/)
  assert.match(header, /:aria-expanded="expandedMobileModuleId === module\.id"/)
  assert.match(header, /module\.menuItems\.length > 1 && expandedMobileModuleId === module\.id/)
  assert.match(header, /:items="module\.menuItems"/)
  assert.match(header, /<AppUserMenu inline size="md"/)
  assert.match(header, /v-if="hasMultipleOrganizations"/)
  assert.match(header, /:aria-label="t\('menu\.switchOrganization'\)"/)
  assert.match(header, /icon="i-lucide-arrow-left-right"/)
  assert.doesNotMatch(moduleNavigation, /\?\? modules\.value\[0\]/)
  assert.match(layout, /:items="activeModuleMenuItems"/)
  assert.match(layout, /:min-size="18"/)
  assert.match(layout, /data-\[collapsed=true\]:min-w-0/)
})
