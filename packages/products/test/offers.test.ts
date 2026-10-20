import assert from 'node:assert/strict'
import test from 'node:test'
import { effectivePricing, offerPricesValid, offerSchema, periodsOverlap, localOfferTimestamp } from '../shared/offers'
import { emptyProduct } from '../shared/validation'
import type { Product, ProductOffer } from '../shared/types'

const base: Product = {
  ...emptyProduct(),
  id: 'product',
  categoryId: null,
  updatedAt: '',
  prices: [{ id: 'regular', currency: 'EUR', amount: 1000, taxBehavior: 'inclusive' }]
}
const offer: ProductOffer = {
  id: 'offer',
  startsAt: '2026-10-20T10:00:00Z',
  endsAt: '2026-10-20T11:00:00Z',
  enabled: true,
  isFree: false,
  prices: [{ ...base.prices[0]!, id: 'discount', amount: 500 }]
}

test('effective prices include start, exclude end, and retain original amounts', () => {
  const product = { ...base, offers: [offer] }
  for (const [at, amount, id] of [
    ['2026-10-20T09:59:59.999Z', 1000, 'regular'],
    [offer.startsAt, 500, 'discount'],
    ['2026-10-20T10:59:59.999Z', 500, 'discount'],
    [offer.endsAt, 1000, 'regular']
  ] as const) {
    const price = effectivePricing(product, new Date(at)).prices[0]!
    assert.equal(price.amount, amount)
    assert.equal(price.originalAmount, 1000)
    assert.equal(price.id, id)
    assert.equal(price.offer?.id ?? null, id === 'discount' ? 'offer' : null)
  }
  assert.equal(product.prices[0]!.amount, 1000)
})
test('free periods, cancellation, adjacency, and permanently free products resolve correctly', () => {
  const free = { ...offer, isFree: true, prices: [{ ...offer.prices[0]!, amount: 0 }] }
  const product = { ...base, offers: [free] }
  assert.equal(effectivePricing(product, new Date(offer.startsAt)).isFree, true)
  assert.equal(effectivePricing(product, new Date(offer.startsAt)).prices[0]!.originalAmount, 1000)
  assert.equal(effectivePricing(product, new Date(offer.endsAt)).isFree, false)
  assert.equal(
    effectivePricing({ ...base, offers: [{ ...free, enabled: false }] }, new Date(offer.startsAt)).prices[0]!.amount,
    1000
  )
  const next = { ...free, id: 'next', startsAt: offer.endsAt, endsAt: '2026-10-20T12:00:00Z' }
  assert.equal(periodsOverlap(offer, next), false)
  assert.equal(periodsOverlap(offer, { ...next, startsAt: offer.startsAt }), true)
  assert.equal(
    effectivePricing({ ...base, offers: [offer, next] }, new Date(offer.endsAt)).prices[0]!.offer!.id,
    'next'
  )
  assert.equal(
    effectivePricing({ ...base, isFree: true, prices: [{ ...base.prices[0]!, amount: 0 }] }).prices[0]!.originalAmount,
    0
  )
})
test('offers validate lower prices, supported currencies, duplicates, and bounded periods', () => {
  assert.equal(offerSchema.safeParse(offer).success, true)
  assert.equal(offerSchema.safeParse({ ...offer, endsAt: offer.startsAt }).success, false)
  assert.equal(offerSchema.safeParse({ ...offer, startsAt: '2026-10-20T10:00' }).success, false)
  assert.equal(offerSchema.safeParse({ ...offer, prices: [offer.prices[0], offer.prices[0]] }).success, false)
  assert.equal(offerPricesValid(offer, base, ['EUR']), true)
  for (const amount of [-1, 1000, 1001, 1.2]) {
    assert.equal(offerPricesValid({ ...offer, prices: [{ currency: 'EUR', amount }] }, base, ['EUR']), false)
  }
  assert.equal(offerPricesValid(offer, base, ['EUR', 'USD']), false)
  assert.equal(offerPricesValid(offer, { ...base, isFree: true }, ['EUR']), false)
  assert.equal(offerPricesValid({ ...offer, prices: [{ ...offer.prices[0]!, amount: 0 }] }, base, ['EUR']), true)
})
test('browser-local input converts to UTC and rejects invalid and ambiguous DST times', () => {
  const previous = process.env.TZ
  try {
    process.env.TZ = 'Europe/Amsterdam'
    assert.equal(localOfferTimestamp('2026-10-20T12:00'), '2026-10-20T10:00:00.000Z')
    assert.equal(localOfferTimestamp('2026-03-29T02:30'), null)
    assert.equal(localOfferTimestamp('2026-10-25T02:30'), null)
    assert.equal(localOfferTimestamp('2026-02-30T12:00'), null)
    process.env.TZ = 'Australia/Lord_Howe'
    assert.equal(localOfferTimestamp('2026-04-05T01:45'), null)
  } finally {
    if (previous === undefined) {
      delete process.env.TZ
    } else {
      process.env.TZ = previous
    }
  }
})
