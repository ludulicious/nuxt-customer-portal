import assert from 'node:assert/strict'
import test from 'node:test'
import { canFulfillOrderLine, requiresFulfillment } from '../shared/fulfillment'
import { emptyProduct, productSchema } from '../shared/validation'
import type { Order } from '../shared/types'

const order = { status: 'paid' as const, total: 1000, refunded: 0, disputed: false }
const line = { snapshot: { product: { requiresFulfillment: true } }, total: 1000, refunded: 0, fulfilled: false }

test('manual fulfillment is opt-in independently of product type and rejects non-boolean values', () => {
  for (const type of ['digital', 'service'] as const) {
    const input = { ...emptyProduct(), type, slug: 'example' }
    input.content.en.title = 'Example'
    const { requiresFulfillment: _flag, ...legacy } = input
    assert.equal(productSchema.parse(legacy).requiresFulfillment, false)
    assert.equal(productSchema.parse({ ...input, requiresFulfillment: true }).requiresFulfillment, true)
    assert.equal(productSchema.safeParse({ ...input, requiresFulfillment: 'true' }).success, false)
  }
  assert.equal(requiresFulfillment({}), false)
  assert.equal(requiresFulfillment({ requiresFulfillment: false }), false)
  assert.equal(requiresFulfillment({ requiresFulfillment: true }), true)
})

test('paid and accepted orders can fulfill only unfinished opted-in lines', () => {
  assert.equal(canFulfillOrderLine(order, line), true)
  assert.equal(canFulfillOrderLine({ ...order, status: 'accepted' }, line), true)
  assert.equal(canFulfillOrderLine(order, { ...line, fulfilled: true }), false)
  assert.equal(canFulfillOrderLine(order, { ...line, snapshot: { product: {} } }), false)
  assert.equal(canFulfillOrderLine(order, { ...line, snapshot: { product: { requiresFulfillment: false } } }), false)
})

test('free orders can require fulfillment without a payment balance', () => {
  assert.equal(canFulfillOrderLine({ ...order, total: 0 }, { ...line, total: 0 }), true)
})

test('pending, failed, expired, disputed and fully refunded orders cannot be fulfilled', () => {
  for (const status of ['pending', 'failed', 'expired'] satisfies Order['status'][]) {
    assert.equal(canFulfillOrderLine({ ...order, status }, line), false)
  }
  assert.equal(canFulfillOrderLine({ ...order, total: null }, line), false)
  assert.equal(canFulfillOrderLine({ ...order, disputed: true }, line), false)
  assert.equal(canFulfillOrderLine({ ...order, refunded: 1000 }, line), false)
  assert.equal(canFulfillOrderLine(order, { ...line, refunded: 1000 }), false)
  assert.equal(canFulfillOrderLine({ ...order, refunded: 500 }, { ...line, refunded: 500 }), true)
})
