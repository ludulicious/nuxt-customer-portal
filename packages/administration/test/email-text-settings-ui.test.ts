import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

test('email texts uses only the page heading, without a duplicate card title', async () => {
  const [page, section] = await Promise.all([
    readFile(new URL('../app/pages/admin/email-texts.vue', import.meta.url), 'utf8'),
    readFile(new URL('../app/components/admin/email/EmailTextSection.vue', import.meta.url), 'utf8')
  ])
  assert.match(page, /<h1[^>]*>\{\{ t\('admin.email.textPage'\) \}\}<\/h1>/)
  assert.doesNotMatch(section, /t\('admin.email.texts'\)/)
  assert.doesNotMatch(section, /<template #header/)
})

test('email text languages follow portal settings, hide single-language navigation, and keep selection enabled', async () => {
  const source = await readFile(new URL('../app/components/admin/email/EmailTextSection.vue', import.meta.url), 'utf8')
  assert.match(source, /'portal-runtime-settings'/)
  assert.match(source, /const locales = computed/)
  assert.match(
    source,
    /!portalSettings.value\?\.languages \|\| portalSettings.value.languages.includes\(locale.value\)/
  )
  assert.match(source, /v-if="locales.length > 1"/)
  assert.match(source, /if \(!available.some\(\(locale\) => locale.value === selectedLocale.value\)\)/)
  assert.match(source, /selectedLocale.value = available\[0\]\?\.value \|\| 'en'/)
  assert.match(source, /immediate: true/)
})

test('email text controls inherit shared surface defaults and preserve semantic selection and preview styling', async () => {
  const source = await readFile(new URL('../app/components/admin/email/EmailTextSection.vue', import.meta.url), 'utf8')
  assert.doesNotMatch(source, /portal-appearance-input|bg-inherit|:ui=/)
  assert.match(source, /selected === item.value \? 'soft' : 'ghost'/)
  assert.match(source, /sandbox=""[\s\S]*?bg-white/)
})

test('Markdown placeholder controls and link inputs inherit the shared theme', async () => {
  const source = await readFile(new URL('../../ui/app/components/PortalMarkdownEditor.vue', import.meta.url), 'utf8')
  assert.doesNotMatch(source, /portal-appearance-input/)
  assert.match(source, /portal-markdown-editor portal-field-surface/)
  assert.match(source, /base: 'rounded-none ring-0 bg-inherit text-inherit'/)
})
