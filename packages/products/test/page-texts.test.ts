import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'
import {
  defaultOrderPageCopy,
  resolveOrderPageCopy,
  resolveProductOrderPageCopy,
  savePageTextSchema,
  pageTextTargetSchema,
  orderPageCopySchema,
  orderPageTextGroups
} from '../shared/page-texts'
import { renderDescription } from '../server/utils/markdown'

test('English and Dutch page defaults cover every editable field exactly once', () => {
  const english = defaultOrderPageCopy('en')
  const dutch = defaultOrderPageCopy('nl')
  assert.equal(english.title, 'Your order')
  assert.equal(dutch.title, 'Je bestelling')
  assert.deepEqual(Object.keys(english).sort(), Object.keys(dutch).sort())
  assert.equal(orderPageCopySchema.safeParse(english).success, true)
  assert.equal(orderPageCopySchema.safeParse(dutch).success, true)
  const fields = orderPageTextGroups.flatMap((group) => [...group.fields])
  assert.equal(new Set(fields).size, fields.length)
  assert.deepEqual([...fields].sort(), Object.keys(english).sort())
})

test('localized page copy inherits blank fields, preserves defaults and does not mutate them', () => {
  const copy = resolveOrderPageCopy({ title: '  Your resources  ', downloadLabel: 'Get file', footer: '   ' }, 'en')
  assert.equal(copy.title, 'Your resources')
  assert.equal(copy.downloadLabel, 'Get file')
  assert.equal(copy.footer, defaultOrderPageCopy('en').footer)
  assert.equal(defaultOrderPageCopy('en').title, 'Your order')
  assert.equal(resolveOrderPageCopy(undefined, 'nl').downloadLabel, defaultOrderPageCopy('nl').downloadLabel)
})

test('page-text writes validate page/language, bound copy and reject client-controlled HTML or store scopes', () => {
  const input = {
    page: 'order-details',
    locale: 'nl',
    copy: { title: 'Welkom', content: '# Welkom\n\nJe **materialen** staan klaar.' }
  }
  assert.equal(savePageTextSchema.safeParse(input).success, true)
  for (const value of [
    { ...input, page: 'unknown' },
    { ...input, locale: 'de' },
    { ...input, storeId: 'other' },
    { ...input, copy: { contentHtml: '<script>evil</script>' } },
    { ...input, copy: { title: 'x'.repeat(241) } },
    { ...input, copy: { content: 'x'.repeat(12001) } },
    { ...input, copy: { unknown: 'value' } }
  ]) {
    assert.equal(savePageTextSchema.safeParse(value).success, false)
  }
  assert.equal(pageTextTargetSchema.safeParse({ page: 'order-details', locale: 'en' }).success, true)
  assert.equal(pageTextTargetSchema.safeParse({ page: 'order-details', locale: 'en', storeId: 'other' }).success, false)
})

test('formatted page introductions preserve Markdown and remove executable content', () => {
  const copy = resolveOrderPageCopy(
    { content: '# Welcome\n\nEnjoy **your resources**.\n\n<script>alert(1)</script>\n\n[bad](javascript:alert(1))' },
    'en'
  )
  const html = renderDescription(copy.content)
  assert.match(html, /<h1>Welcome<\/h1>/)
  assert.match(html, /<strong>your resources<\/strong>/)
  assert.doesNotMatch(html, /<script|javascript:/)
})

test('both admin languages label every editable field and section', async () => {
  for (const locale of ['en', 'nl']) {
    const { products } = JSON.parse(await readFile(new URL(`../i18n/locales/${locale}.json`, import.meta.url), 'utf8'))
    for (const group of orderPageTextGroups) {
      assert.ok(products.storeTextGroups[group.id])
      for (const field of group.fields) {
        assert.ok(products.storeTextFields[field], `${locale}/${field}`)
      }
    }
  }
})

test('only product introductions vary by product; all page wording stays shared per language', () => {
  const entries = [
    {
      page: 'order-details' as const,
      locale: 'en' as const,
      productSlug: '',
      copy: { title: 'Our library', content: 'Store introduction', footer: 'Store footer' }
    },
    {
      page: 'order-details' as const,
      locale: 'en' as const,
      productSlug: 'audio',
      copy: { content: 'Your audio message' }
    },
    {
      page: 'order-details' as const,
      locale: 'nl' as const,
      productSlug: 'audio',
      copy: { content: 'Je audiobericht' }
    }
  ]
  assert.equal(resolveProductOrderPageCopy(entries, 'audio', 'en').title, 'Our library')
  assert.equal(resolveProductOrderPageCopy(entries, 'audio', 'en').content, 'Your audio message')
  assert.equal(resolveProductOrderPageCopy(entries, 'video', 'en').content, 'Store introduction')
  assert.equal(resolveProductOrderPageCopy(entries, 'audio', 'nl').content, 'Je audiobericht')
  assert.equal(
    savePageTextSchema.safeParse({
      page: 'order-details',
      locale: 'en',
      productSlug: 'audio',
      copy: { title: 'Product title' }
    }).success,
    false
  )
  assert.equal(
    savePageTextSchema.safeParse({
      page: 'order-details',
      locale: 'en',
      productSlug: 'audio',
      copy: { content: 'Product introduction' }
    }).success,
    true
  )
})
