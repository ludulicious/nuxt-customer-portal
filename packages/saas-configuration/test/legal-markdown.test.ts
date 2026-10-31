import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { renderLegalMarkdown } from '../shared/legal-markdown'
import { defaultPortalSettings, portalSettingsSchema } from '../shared/settings'

const newline = String.fromCharCode(10)
const tick = String.fromCharCode(96)

test('legal Markdown renders formatting, reference links and tables', () => {
  const html = renderLegalMarkdown(
    [
      '## Your rights',
      '**Important** and *personal* with ' + tick + 'inline code' + tick + '.',
      ['- Access your data', '- Delete your data'].join(newline),
      ['3. Contact us', '4. Receive a reply'].join(newline),
      '> A reminder',
      '---',
      ['[Contact][contact]', '', '[contact]: mailto:privacy@example.com'].join(newline),
      ['| Right | Available |', '| --- | --- |', '| Access | Yes |'].join(newline),
      [tick.repeat(3) + 'text', 'Example', tick.repeat(3)].join(newline)
    ].join(newline.repeat(2))
  )
  for (const expected of [
    '<h2>Your rights</h2>',
    '<strong>Important</strong>',
    '<em>personal</em>',
    '<code>inline code</code>',
    '<ul>',
    '<ol start="3">',
    '<blockquote>',
    '<hr',
    '<a href="mailto:privacy@example.com">Contact</a>',
    '<table>',
    '<th>Right</th>',
    '<pre><code>Example'
  ]) {
    assert.ok(html.includes(expected), expected)
  }
})

test('legal Markdown removes executable content, attributes and unsafe URLs', () => {
  const html = renderLegalMarkdown(
    [
      '<script>alert(1)</script>',
      '<iframe src="https://example.com"></iframe>',
      '<img src="x" onerror="alert(1)">',
      '<p style="position:fixed" onclick="alert(1)">Safe text</p>',
      '<a href="javascript:alert(1)">Unsafe</a>',
      '<a href="jav&#x61;script:alert(1)">Encoded</a>',
      '[Data](data:text/html,unsafe)',
      '[Protocol relative](//example.com)',
      '[HTTPS](https://example.com) [Email](mailto:privacy@example.com) [Local](/terms)'
    ].join(newline.repeat(2))
  )
  for (const unsafe of [
    '<script',
    '<iframe',
    '<img',
    'onerror',
    'onclick',
    'style=',
    'javascript:',
    'data:',
    'href="//'
  ]) {
    assert.ok(!html.includes(unsafe), unsafe)
  }
  for (const safe of [
    '<p>Safe text</p>',
    'href="https://example.com"',
    'href="mailto:privacy@example.com"',
    'href="/terms"'
  ]) {
    assert.ok(html.includes(safe), safe)
  }
})

test('legal Markdown preserves plain text and line breaks, escapes code and supports empty bodies', () => {
  assert.equal(
    renderLegalMarkdown('First line' + newline + 'Second line'),
    '<p>First line<br />Second line</p>' + newline
  )
  assert.equal(renderLegalMarkdown(''), '')
  const code = [tick.repeat(3), '<script>alert(1)</script>', tick.repeat(3)].join(newline)
  assert.ok(renderLegalMarkdown(code).includes('&lt;script&gt;'))
})

test('localized legal content retains Markdown in the existing settings schema', () => {
  const settings = defaultPortalSettings()
  for (const locale of ['en', 'nl'] as const) {
    settings.content[locale].terms.body = '## Terms ' + locale + newline + '**Accept**'
    settings.content[locale].privacy.body = '## Privacy ' + locale + newline + '- Your data'
  }
  assert.deepEqual(portalSettingsSchema.parse(settings).content, settings.content)
})

test('public legal pages retain locale fallback and use the sanitized shared component', async () => {
  for (const page of ['terms', 'privacy']) {
    const source = await readFile(new URL('../app/pages/' + page + '.vue', import.meta.url), 'utf8')
    for (const expected of [
      'public: true',
      'locale.value',
      'settings.value?.content?.en',
      '<PortalLegalContent v-if="page" :title="page.title" :body="page.body"'
    ]) {
      assert.ok(source.includes(expected), expected)
    }
  }
  const component = await readFile(new URL('../app/components/PortalLegalContent.vue', import.meta.url), 'utf8')
  assert.ok(component.includes('computed(() => renderLegalMarkdown(props.body))'))
  assert.ok(component.includes('v-html="html"'))
})

test('legal editors use locale-keyed Markdown fields within existing form fields', async () => {
  const source = await readFile(new URL('../app/components/portal-settings/LegalStep.vue', import.meta.url), 'utf8')
  assert.equal(source.split('<PortalMarkdownEditor').length - 1, 2)
  assert.ok(source.includes('v-model="section.terms.body"'))
  assert.ok(source.includes('v-model="section.privacy.body"'))
  assert.ok(source.includes('-terms'))
  assert.ok(source.includes('-privacy'))
  assert.ok(!source.includes('<UTextarea'))
})
