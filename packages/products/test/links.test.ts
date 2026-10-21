import assert from 'node:assert/strict'
import test from 'node:test'
import { purchasedLinkSchema, purchasedLinksSchema, purchaseLinks } from '../shared/links'
import { emptyProduct, productSchema } from '../shared/validation'
import { publishChecks } from '../shared/publish'
import { downloadLinksMarkdown } from '../shared/downloads'
import { renderDescription } from '../server/utils/markdown'
import type { Order } from '../shared/types'

const link = () => ({
  id: 'b84e1b42-704b-4aa8-bf2c-906ca3254877',
  url: 'https://docs.google.com/document/d/example/edit',
  labels: { en: 'Your workbook', nl: 'Je werkboek' }
})
const purchase = () =>
  ({
    status: 'paid',
    total: 1000,
    refunded: 0,
    disputed: false,
    snapshot: { locale: 'en' },
    lines: [{ id: 'one', total: 1000, refunded: 0, snapshot: { product: { links: [link()] } } }]
  }) as Order

test('purchased links accept web URLs and reject unsafe or malformed destinations and duplicate identities', () => {
  for (const url of [
    'https://youtu.be/example?t=10',
    'http://example.test/resource',
    'https://example.test/(lesson)?q=a&b=c#chapter'
  ]) {
    assert.equal(purchasedLinkSchema.safeParse({ ...link(), url }).success, true)
  }
  for (const url of [
    'javascript:alert(1)',
    'data:text/html,hi',
    'file:///etc/passwd',
    '//example.test',
    '/relative',
    'invalid',
    'https://user:secret@example.test',
    'ftp://example.test/a'
  ]) {
    assert.equal(purchasedLinkSchema.safeParse({ ...link(), url }).success, false, url)
  }
  assert.equal(purchasedLinksSchema.safeParse([link(), link()]).success, false)
  assert.equal(purchasedLinkSchema.safeParse({ ...link(), labels: { en: 'x'.repeat(201), nl: '' } }).success, false)
})

test('link-only digital products pass validation and the publish delivery check', () => {
  const product = {
    ...emptyProduct(),
    status: 'published',
    slug: 'workbook',
    isFree: true,
    content: {
      en: { title: 'Workbook', summary: 'Summary', description: 'Description' },
      nl: { title: 'Werkboek', summary: 'Samenvatting', description: 'Beschrijving' }
    },
    thumbnailImageId: 'image',
    imageIds: ['image'],
    galleryImageIds: ['image'],
    detailImageIds: ['image'],
    links: [link()]
  }
  assert.equal(productSchema.safeParse(product).success, true)
  assert.equal(
    publishChecks(productSchema.parse(product), { languages: ['en', 'nl'], currencies: ['EUR'], enabled: true }).every(
      (check) => check.passed
    ),
    true
  )
  assert.equal(productSchema.safeParse({ ...product, links: [] }).success, false)
  const { links: _links, ...legacy } = { ...product, status: 'draft' }
  assert.deepEqual(productSchema.parse(legacy).links, [])
})

test('links follow payment, refund and dispute access rules and purchase language', () => {
  const order = purchase()
  assert.deepEqual(purchaseLinks(order), [{ id: link().id, name: 'Your workbook', url: link().url }])
  order.snapshot.locale = 'nl'
  assert.equal(purchaseLinks(order)[0]?.name, 'Je werkboek')
  for (const state of [
    { status: 'pending' },
    { status: 'failed' },
    { status: 'expired' },
    { status: 'cancelled' },
    { total: null },
    { disputed: true },
    { refunded: 1000 }
  ]) {
    assert.deepEqual(purchaseLinks({ ...order, ...state }), [], JSON.stringify(state))
  }
  assert.equal(purchaseLinks({ ...order, status: 'accepted' }).length, 1)
  assert.equal(purchaseLinks({ ...order, total: 0 }).length, 1)
  order.lines[0]!.refunded = 1000
  assert.deepEqual(purchaseLinks(order), [])
})

test('delivery preserves per-line ordering and excludes refunded lines and legacy products', () => {
  const order = purchase()
  const second = { ...link(), id: '490e6e4e-0935-4cc8-aee6-cd2179758b41', labels: { en: 'Second', nl: 'Tweede' } }
  order.lines[0]!.snapshot.product.links!.push(second)
  assert.deepEqual(
    purchaseLinks(order).map((item) => item.name),
    ['Your workbook', 'Second']
  )
  order.lines.push({ ...order.lines[0]!, id: 'refunded', refunded: 1000 })
  assert.equal(purchaseLinks(order).length, 2)
  delete order.lines[0]!.snapshot.product.links
  assert.deepEqual(purchaseLinks(order), [])
})

test('email Markdown safely renders external URLs, localized labels and mixed file delivery', () => {
  const links = [
    { id: 'file', name: 'Audio.mp3', url: 'https://portal.test/download' },
    { id: 'link', name: 'Workbook [one]\n<script>', url: 'https://example.test/(lesson)?q=a&b=c' }
  ]
  const markdown = downloadLinksMarkdown(links)
  const html = renderDescription(markdown)
  assert.match(html, /href="https:\/\/example.test\/%28lesson%29\?q=a&amp;b=c"/)
  assert.match(html, /Audio.mp3/)
  assert.doesNotMatch(html, /<script>/)
})
