import assert from 'node:assert/strict'
import test from 'node:test'
import { downloadableLine, downloadEmailMarkdown, purchaseReturnUrl } from '../shared/downloads'
import { checkoutReturnPath } from '../server/utils/checkout-return'
import type { Order } from '../shared/types'

const purchase = () =>
  ({
    status: 'paid',
    total: 2000,
    refunded: 0,
    disputed: false,
    lines: [
      { id: 'a', total: 1000, refunded: 1000, snapshot: { product: { fileIds: ['refunded-file', 'shared-file'] } } },
      { id: 'b', total: 1000, refunded: 0, snapshot: { product: { fileIds: ['paid-file', 'shared-file'] } } }
    ]
  }) as Order

test('public downloads authorize each file against the purchased line and current payment state', () => {
  const order = purchase()
  assert.equal(downloadableLine(order, 'paid-file')?.id, 'b')
  assert.equal(downloadableLine(order, 'shared-file')?.id, 'b')
  assert.equal(downloadableLine(order, 'refunded-file'), undefined)
  assert.equal(downloadableLine(order, 'unrelated-file'), undefined)
  for (const state of [
    { status: 'pending' },
    { status: 'expired' },
    { status: 'failed' },
    { total: null },
    { disputed: true },
    { refunded: 2000 }
  ]) {
    assert.equal(downloadableLine({ ...order, ...state }, 'paid-file'), undefined)
  }
  order.lines[1]!.refunded = 1000
  assert.equal(downloadableLine(order, 'paid-file'), undefined)
  order.total = 0
  order.lines[1]!.total = 0
  order.lines[1]!.refunded = 0
  assert.equal(downloadableLine(order, 'paid-file')?.id, 'b')
})

test('only success routes pass a purchase credential, preserving the host query and fragment', () => {
  const input = { slug: 'test', locale: 'en' as const, currency: 'EUR', downloadToken: 'secret' }
  for (const outcome of ['failed', 'cancelled', 'expired'] as const) {
    assert.equal(
      new URL(checkoutReturnPath({ ...input, outcome }), 'https://portal.test').searchParams.has('purchase'),
      false
    )
  }
  assert.equal(
    new URL(checkoutReturnPath({ ...input, outcome: 'success' }), 'https://portal.test').searchParams.get('purchase'),
    'secret'
  )
  assert.equal(purchaseReturnUrl(undefined, 'secret'), undefined)
  assert.equal(
    purchaseReturnUrl('https://host.test/thanks?campaign=a#files', 'secret'),
    'https://host.test/thanks?campaign=a&purchase=secret#files'
  )
})

test('confirmation emails contain readable localized links with escaped filenames', () => {
  const files = [{ id: 'one', name: 'File [one]\n.pdf', url: 'https://portal.test/file' }]
  assert.equal(downloadEmailMarkdown([], 'en'), '')
  assert.equal(
    downloadEmailMarkdown(files, 'en'),
    'Download your files:\n\n- [File \\[one\\] .pdf](https://portal.test/file)'
  )
  assert.match(downloadEmailMarkdown(files, 'nl'), /^Download je bestanden:/)
})
