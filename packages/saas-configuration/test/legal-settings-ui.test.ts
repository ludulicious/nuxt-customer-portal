import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

test('legal language selection follows enabled portal languages and falls back when a language is removed', async () => {
  const source = await readFile(new URL('../app/components/portal-settings/LegalStep.vue', import.meta.url), 'utf8')
  assert.match(source, /v-for="code in state.languages"/)
  assert.match(source, /v-if="state.languages.length > 1"/)
  assert.doesNotMatch(source, /v-for="code in \['en', 'nl'\]/)
  assert.match(source, /\(\) => state.value.languages/)
  assert.match(source, /if \(!languages.includes\(locale.value\)\)/)
  assert.match(source, /locale.value = languages\[0\] \|\| 'en'/)
  assert.match(source, /immediate: true, deep: true/)
})

test('legal controls inherit the shared theme instead of overriding individual input backgrounds', async () => {
  const [legal, editor] = await Promise.all([
    readFile(new URL('../app/components/portal-settings/LegalStep.vue', import.meta.url), 'utf8'),
    readFile(new URL('../../ui/app/components/PortalMarkdownEditor.vue', import.meta.url), 'utf8')
  ])
  for (const page of ['terms', 'privacy']) {
    assert.ok(legal.includes(`v-model="section.${page}.title" class="w-full"`))
  }
  assert.doesNotMatch(legal, /portal-appearance-input|:ui=/)
  assert.match(editor, /class="portal-markdown-editor portal-field-surface /)
  assert.match(editor, /base: 'rounded-none ring-0 bg-inherit text-inherit'/)
})
