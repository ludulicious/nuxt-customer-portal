import assert from 'node:assert/strict'
import test from 'node:test'
import { purchaseThankYouVariant, thankYouCopySchema } from '../shared/thank-you'
import { checkoutAppearanceSchema } from '../shared/checkout-appearance'

test('thank-you variants follow the order amount, including expired free offers and invoiced orders', () => {
  assert.equal(purchaseThankYouVariant({ total: 0, lines: [{ unit_amount: 0 }] }), 'free')
  assert.equal(purchaseThankYouVariant({ total: 1200, lines: [{ unit_amount: 1000 }] }), 'paid')
  assert.equal(purchaseThankYouVariant({ total: null, lines: [{ unit_amount: 0 }] }), 'free')
  assert.equal(purchaseThankYouVariant({ total: null, lines: [] }), 'paid')
  assert.equal(purchaseThankYouVariant({ total: null, lines: [{ unit_amount: 0 }, { unit_amount: 1000 }] }), 'paid')
})

test('editable thank-you copy is bounded plain text with all required fields', () => {
  const copy = {
    statusLabel: 'Ready',
    heading: 'Your gift',
    message: 'Welcome\nEnjoy your gift.',
    helpText: '',
    downloadsHeading: 'Downloads'
  }
  assert.equal(thankYouCopySchema.safeParse(copy).success, true)
  assert.equal(thankYouCopySchema.safeParse({ ...copy, message: 'x'.repeat(4001) }).success, false)
  assert.equal(thankYouCopySchema.safeParse({ heading: 'Incomplete' }).success, false)
})

test('older stores keep standard copy and content endpoints must be HTTP URLs', () => {
  assert.equal(checkoutAppearanceSchema.parse({}).thankYouContentUrl, '')
  assert.equal(checkoutAppearanceSchema.safeParse({ thankYouContentUrl: 'javascript:alert(1)' }).success, false)
  assert.equal(
    checkoutAppearanceSchema.parse({ thankYouContentUrl: 'https://host.test/api/thank-you/content' })
      .thankYouContentUrl,
    'https://host.test/api/thank-you/content'
  )
})
