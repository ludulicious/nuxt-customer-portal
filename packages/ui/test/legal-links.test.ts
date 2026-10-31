import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

test('sidebar footer keeps legal links in both navigation modes and closes the mobile menu', async () => {
  const layout = await readFile(new URL('../app/layouts/default.vue', import.meta.url), 'utf8')
  const footer = layout.split('<template #footer="{ collapsed, collapse }">')[1]?.split('</template>')[0]
  assert.ok(footer)
  assert.ok(footer.includes('<PortalLegalLinks :collapsed="collapsed" @navigate="open = false"'))
  assert.ok(!footer.includes('unifiedNavigation'))
  assert.ok(footer.includes('@click="collapse(!collapsed)"'))
})

test('legal links are subtle, localized and accessible when collapsed', async () => {
  const source = await readFile(new URL('../app/components/PortalLegalLinks.vue', import.meta.url), 'utf8')
  for (const expected of [
    "to: '/terms'",
    "to: '/privacy'",
    'text-xs text-muted',
    'focus-visible:outline',
    "t('portalLegal.navigation')",
    "'sr-only': collapsed",
    'collapsed ? link.label : undefined',
    "emit('navigate')"
  ]) {
    assert.ok(source.includes(expected), expected)
  }
  for (const locale of ['en', 'nl']) {
    const messages = JSON.parse(await readFile(new URL('../i18n/locales/' + locale + '.json', import.meta.url), 'utf8'))
    assert.ok(messages.portalLegal.navigation)
    assert.ok(messages.portalLegal.terms)
    assert.ok(messages.portalLegal.privacy)
  }
})
