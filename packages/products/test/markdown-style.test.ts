import assert from 'node:assert/strict'
import test from 'node:test'
import { markdownStyleSchema, defaultMarkdownStyle } from '../shared/markdown-style'
import { settingsSchema } from '../shared/validation'

test('Markdown theme has readable defaults and bounds typography values', () => {
  assert.equal(defaultMarkdownStyle().fontSize, 16)
  assert.equal(markdownStyleSchema.safeParse({ fontSize: 100 }).success, false)
  assert.equal(markdownStyleSchema.safeParse({ lineHeight: 0 }).success, false)
  assert.equal(markdownStyleSchema.safeParse({ paragraphSpacing: -1 }).success, false)
  assert.equal(markdownStyleSchema.safeParse({ headingScale: 8 }).success, false)
})
test('Markdown theme accepts only approved fonts and hex colors', () => {
  assert.equal(
    markdownStyleSchema.safeParse({ fontFamily: 'serif', textColor: '#123AbC', backgroundColor: '' }).success,
    true
  )
  assert.equal(markdownStyleSchema.safeParse({ fontFamily: 'url(https://example.com)' }).success, false)
  assert.equal(markdownStyleSchema.safeParse({ textColor: 'red; position:fixed' }).success, false)
  assert.equal(markdownStyleSchema.safeParse({ linkColor: 'url(https://example.com)' }).success, false)
})
test('settings supports a theme and leaves it omitted for older callers', () => {
  const input = { enabled: false, defaultLocale: 'en', currencies: ['EUR'] }
  assert.equal(settingsSchema.parse(input).markdownStyle, undefined)
  assert.equal(settingsSchema.parse({ ...input, markdownStyle: { fontSize: 18 } }).markdownStyle?.fontSize, 18)
})

test('bullet settings default for older themes and validate style and color', () => {
  const legacy = markdownStyleSchema.parse({ fontSize: 18 })
  assert.equal(legacy.bulletStyle, 'disc')
  assert.equal(legacy.bulletColor, '')
  assert.equal(markdownStyleSchema.parse({ bulletStyle: 'sparkle', bulletColor: '#ffcc00' }).bulletStyle, 'sparkle')
  assert.equal(markdownStyleSchema.safeParse({ bulletStyle: 'url(example)' }).success, false)
  assert.equal(markdownStyleSchema.safeParse({ bulletColor: 'red;display:none' }).success, false)
})

test('heading color overrides default to inherited and validate each level', () => {
  const legacy = markdownStyleSchema.parse({ headingColor: '#123456' })
  for (const key of ['h1Color', 'h2Color', 'h3Color', 'h4Color', 'h5Color', 'h6Color'] as const) {
    assert.equal(legacy[key], '')
    assert.equal(markdownStyleSchema.parse({ [key]: '#abcdef' })[key], '#abcdef')
    assert.equal(markdownStyleSchema.safeParse({ [key]: 'invalid' }).success, false)
  }
})
