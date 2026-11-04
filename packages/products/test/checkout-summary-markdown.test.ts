import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import test from 'node:test'
import { renderDescription } from '../server/utils/markdown'

test('checkout and booking summaries use server-rendered Markdown and the configured product theme', () => {
  for (const path of ['../app/pages/store/[slug].vue', '../../planning/app/pages/booking/[slug].vue']) {
    const page = readFileSync(new URL(path, import.meta.url), 'utf8')
    assert.match(
      page,
      /<div class="order-summary">\s*<ProductsMarkdown :html="product.summaryHtml" :theme="product.markdownStyle"\s*\/>/
    )
    assert.doesNotMatch(page, /\{\{ product.summary \}\}/)
  }
})

test('mobile offering details also render Markdown rather than showing the source', () => {
  const booking = readFileSync(new URL('../../planning/app/pages/booking/[slug].vue', import.meta.url), 'utf8')
  assert.match(
    booking,
    /<details class="mobile-offering-details">[\s\S]*?<ProductsMarkdown :html="product.summaryHtml" :theme="product.markdownStyle"\s*\/>/
  )
})

test('admin previews render both summaries and extended descriptions as Markdown', () => {
  const preview = readFileSync(new URL('../app/components/ProductsPreviewCard.vue', import.meta.url), 'utf8')
  assert.match(preview, /<ProductsMarkdown :html="copy.summaryHtml" :theme="markdownStyle"/)
  assert.match(
    preview,
    /<ProductsMarkdown v-if="copy.descriptionHtml" :html="copy.descriptionHtml" :theme="markdownStyle"/
  )
  const catalog = readFileSync(new URL('../server/utils/catalog.ts', import.meta.url), 'utf8')
  assert.match(catalog, /summaryHtml: renderDescription\(copy.summary\)/)
  assert.match(catalog, /descriptionHtml: renderDescription\(copy.description\)/)
})

test('product and planning views never interpolate raw product summary or description Markdown', () => {
  for (const directory of ['../app/', '../../planning/app/']) {
    const root = new URL(directory, import.meta.url)
    for (const filename of readdirSync(root, { recursive: true }).filter((name) => name.endsWith('.vue'))) {
      const page = readFileSync(new URL(filename, root), 'utf8')
      const template = page.match(/<template>([\s\S]*)<\/template>/)?.[1] || ''
      assert.doesNotMatch(template, /\{\{[^}]*\b(?:product|copy)\??\.(?:summary|description)\b/, filename)
    }
  }
})

test('summary formatting is rendered without allowing executable markup', () => {
  const html = renderDescription(
    'Explore your **relationship with yourself**, with *care*.\n\n<script>alert(1)</script>'
  )
  assert.match(html, /<strong>relationship with yourself<\/strong>/)
  assert.match(html, /<em>care<\/em>/)
  assert.doesNotMatch(html, /<script>/)
})
