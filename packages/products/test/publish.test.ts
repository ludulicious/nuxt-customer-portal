import assert from 'node:assert/strict'
import test from 'node:test'
import { publishChecks } from '../shared/publish'
import { emptyProduct } from '../shared/validation'

test('publish checklist requires every enabled translation, image, currency and digital file', () => {
  const product = emptyProduct()
  const settings = { languages: ['en', 'nl'] as ('en' | 'nl')[], currencies: ['EUR', 'USD'], enabled: true }
  let checks = publishChecks(product, settings)
  assert.equal(checks.filter((c) => !c.passed && !c.warning).length, 7)
  product.content.en = { title: 'Audio', summary: 'Summary', description: 'Description' }
  product.content.nl = { title: 'Audio', summary: 'Samenvatting', description: 'Beschrijving' }
  product.imageIds = ['image']
  product.thumbnailImageId = 'image'
  product.galleryImageIds = ['image']
  product.detailImageIds = ['image']
  product.fileIds = ['file']
  product.prices = settings.currencies.map((currency) => ({
    currency,
    amount: 1000,
    taxBehavior: 'inclusive' as const
  }))
  checks = publishChecks(product, settings)
  assert.equal(
    checks.every((c) => c.passed),
    true
  )
  product.content.nl.description = '  '
  assert.equal(publishChecks(product, settings).find((c) => c.value === 'nl')?.passed, false)
  assert.equal(
    publishChecks(product, { ...settings, languages: ['en'] }).every((c) => c.passed),
    true
  )
})

test('free services skip currency and file checks; closed store is a nonblocking warning', () => {
  const product = {
    ...emptyProduct(),
    type: 'service' as const,
    isFree: true,
    prices: [],
    imageIds: ['image'],
    thumbnailImageId: 'image',
    galleryImageIds: ['image'],
    detailImageIds: ['image']
  }
  product.content.en = { title: 'Coaching', summary: 'Summary', description: 'Description' }
  const checks = publishChecks(product, { languages: ['en'], currencies: ['EUR', 'USD'], enabled: false })
  assert.equal(
    checks.every((c) => c.passed || c.warning),
    true
  )
  assert.equal(
    checks.some((c) => c.key === 'publishPrice' || c.key === 'publishFile'),
    false
  )
  assert.equal(checks.find((c) => c.key === 'publishStoreOpen')?.passed, false)
})
