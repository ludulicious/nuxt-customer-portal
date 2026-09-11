import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import {
  emptyProduct,
  productSchema,
  productCreateSchema,
  priceSchema,
  checkoutSchema,
  settingsSchema,
  hasRequiredPrices
} from '../shared/validation'
import { currencyScale, formatMoney } from '../shared/money'
import { hasPurchaseAccess } from '../shared/access'

test('publishing requires translated identity, a price and digital delivery', () => {
  const product = emptyProduct()
  product.slug = 'audio'
  product.content.en.title = 'Audio'
  product.imageIds = ['image']
  product.thumbnailImageId = 'image'
  product.galleryImageIds = ['image']
  product.detailImageIds = ['image']
  assert.equal(productSchema.safeParse(product).success, true)
  assert.equal(productSchema.safeParse({ ...product, status: 'published' }).success, false)
  assert.equal(productSchema.safeParse({ ...product, status: 'published', fileIds: ['file'] }).success, true)
  assert.equal(productSchema.safeParse({ ...product, type: 'service', status: 'published' }).success, true)
  assert.equal(productSchema.safeParse({ ...product, prices: [product.prices[0], product.prices[0]] }).success, false)
  assert.equal(productSchema.safeParse({ ...product, videoUrl: 'javascript:alert(1)' }).success, false)
})
test('currency pricing preserves zero- and three-decimal units', () => {
  assert.equal(currencyScale('JPY'), 1)
  assert.equal(currencyScale('KWD'), 1000)
  assert.equal(currencyScale('EUR'), 100)
  assert.match(formatMoney(1234, 'KWD', 'en'), /1\.234/)
  for (const amount of [0, -1, 1.5, Infinity]) {
    assert.equal(priceSchema.safeParse({ currency: 'EUR', amount, taxBehavior: 'inclusive' }).success, false)
  }
  assert.equal(priceSchema.safeParse({ currency: 'XXX', amount: 100, taxBehavior: 'inclusive' }).success, false)
})
test('checkout rejects incomplete billing and does not accept browser prices', () => {
  const input = {
    productId: 'product',
    priceId: 'price',
    requestId: 'a14c2702-8eb1-40bd-81ce-5ad49b86e611',
    locale: 'nl',
    billing: {
      type: 'person',
      name: 'Buyer',
      email: 'BUYER@example.test',
      company: '',
      address: 'Street 1, 1234 AB Amsterdam',
      country: 'NL',
      registrationNumber: '',
      vatNumber: ''
    }
  }
  assert.equal(checkoutSchema.parse({ ...input, amount: 1 }).billing.email, 'buyer@example.test')
  assert.equal('amount' in checkoutSchema.parse({ ...input, amount: 1 }), false)
  assert.equal(
    checkoutSchema.safeParse({ ...input, billing: { ...input.billing, type: 'organization' } }).success,
    false
  )
})
test('payment state gates access including full refunds and disputes', () => {
  const paid = { status: 'paid' as const, total: 1000, refunded: 0, disputed: false }
  assert.equal(hasPurchaseAccess(paid), true)
  assert.equal(hasPurchaseAccess({ ...paid, refunded: 500 }), true)
  assert.equal(hasPurchaseAccess({ ...paid, refunded: 1000 }), false)
  assert.equal(hasPurchaseAccess({ ...paid, disputed: true }), false)
  assert.equal(hasPurchaseAccess({ ...paid, status: 'pending' }), false)
  assert.equal(hasPurchaseAccess({ ...paid, total: null }), false)
})
test('English and Dutch provide matching interface translations', () => {
  const en = JSON.parse(readFileSync(new URL('../i18n/locales/en.json', import.meta.url), 'utf8')).products
  const nl = JSON.parse(readFileSync(new URL('../i18n/locales/nl.json', import.meta.url), 'utf8')).products
  assert.deepEqual(Object.keys(en).sort(), Object.keys(nl).sort())
})

test('store currencies are required and paid products cover every currency', () => {
  assert.equal(settingsSchema.safeParse({ enabled: false, defaultLocale: 'en', currencies: [] }).success, false)
  assert.equal(
    settingsSchema.safeParse({ enabled: false, defaultLocale: 'en', currencies: ['EUR', 'EUR'] }).success,
    false
  )
  assert.equal(
    settingsSchema.safeParse({ enabled: false, defaultLocale: 'en', currencies: ['EUR', 'USD'] }).success,
    true
  )
  assert.equal(hasRequiredPrices(emptyProduct(), ['EUR', 'USD']), false)
  assert.equal(
    hasRequiredPrices(
      {
        prices: [
          { currency: 'EUR', amount: 100 },
          { currency: 'USD', amount: 0 }
        ]
      },
      ['EUR', 'USD']
    ),
    false
  )
  assert.equal(
    hasRequiredPrices(
      {
        prices: [
          { currency: 'EUR', amount: 100 },
          { currency: 'USD', amount: 200 }
        ]
      },
      ['EUR', 'USD']
    ),
    true
  )
  const free = {
    ...emptyProduct(),
    slug: 'free',
    content: { en: { title: 'Free', summary: '', description: '' }, nl: { title: '', summary: '', description: '' } },
    isFree: true,
    prices: []
  }
  assert.equal(productSchema.safeParse(free).success, true)
  assert.equal(hasRequiredPrices(free, ['EUR', 'USD']), true)
  assert.equal(productSchema.safeParse({ ...free, isFree: false }).success, true)
  for (const prices of [[], [{ currency: 'EUR', amount: 0, taxBehavior: 'inclusive' }]]) {
    const paid = { ...free, isFree: false, type: 'service', prices }
    assert.equal(productSchema.safeParse(paid).success, true)
    assert.equal(productSchema.safeParse({ ...paid, status: 'published' }).success, false)
  }
  assert.equal(hasPurchaseAccess({ status: 'paid', total: 0, refunded: 0, disputed: false }), true)
  assert.equal(hasPurchaseAccess({ status: 'pending', total: 0, refunded: 0, disputed: false }), false)
})

test('store languages require a supported default and preserve bilingual defaults', () => {
  const settings = { enabled: false, defaultLocale: 'en', currencies: ['EUR'] }
  assert.deepEqual(settingsSchema.parse(settings).languages, ['en', 'nl'])
  assert.equal(settingsSchema.safeParse({ ...settings, languages: [] }).success, false)
  assert.equal(settingsSchema.safeParse({ ...settings, languages: ['en', 'en'] }).success, false)
  assert.equal(settingsSchema.safeParse({ ...settings, languages: ['fr'] }).success, false)
  assert.equal(settingsSchema.safeParse({ ...settings, languages: ['nl'] }).success, false)
  assert.equal(settingsSchema.safeParse({ ...settings, defaultLocale: 'nl', languages: ['nl'] }).success, true)
})

test('store tax treatment accepts independent settings per supported currency', () => {
  const settings = { enabled: false, defaultLocale: 'en', currencies: ['EUR', 'USD'] }
  assert.equal(
    settingsSchema.safeParse({ ...settings, currencyTaxBehavior: { EUR: 'inclusive', USD: 'exclusive' } }).success,
    true
  )
  assert.equal(settingsSchema.safeParse({ ...settings, currencyTaxBehavior: { EUR: 'invalid' } }).success, false)
  assert.equal(settingsSchema.safeParse({ ...settings, currencyTaxBehavior: { XXX: 'inclusive' } }).success, false)
})

test('new products require a category, while existing uncategorized drafts remain editable', () => {
  const product = { ...emptyProduct(), slug: 'new-product' }
  product.content.en.title = 'New product'
  assert.equal(productCreateSchema.safeParse(product).success, false)
  assert.equal(productCreateSchema.safeParse({ ...product, categoryId: 'category-id' }).success, true)
  assert.equal(productSchema.safeParse(product).success, true)
})

test('subtitles are optional, localized and limited to 200 characters', () => {
  const product = emptyProduct()
  product.slug = 'subtitle-example'
  product.content.en.title = 'Example'
  product.content.en.subtitle = 'Your next step'
  product.content.nl.subtitle = 'Jouw volgende stap'
  const parsed = productSchema.parse(product)
  assert.equal(parsed.content.en.subtitle, 'Your next step')
  assert.equal(parsed.content.nl.subtitle, 'Jouw volgende stap')
  const { subtitle: _subtitle, ...legacyCopy } = product.content.en
  assert.equal(productSchema.parse({ ...product, content: { ...product.content, en: legacyCopy } }).content.en.subtitle, '')
  product.content.en.subtitle = 'a'.repeat(201)
  assert.equal(productSchema.safeParse(product).success, false)
})
