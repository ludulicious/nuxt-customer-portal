import assert from 'node:assert/strict'
import test from 'node:test'
import { checkoutReturnPath, hostThankYouUrl } from '../server/utils/checkout-return'

test('payment returns preserve product, locale and currency', () => {
  assert.equal(
    checkoutReturnPath({ slug: 'discover-yourself', locale: 'nl', currency: 'USD', outcome: 'failed' }),
    '/store/payment-return/discover-yourself?locale=nl&currency=USD&payment=failed'
  )
})

test('payment return paths encode product slugs', () => {
  assert.equal(
    checkoutReturnPath({ slug: 'offer/preview', locale: 'en', currency: 'EUR', outcome: 'cancelled' }),
    '/store/payment-return/offer%2Fpreview?locale=en&currency=EUR&payment=cancelled'
  )
})

test('payment return paths retain the originating offer URL', () => {
  assert.equal(
    checkoutReturnPath({
      slug: 'intake',
      locale: 'en',
      currency: 'USD',
      outcome: 'expired',
      returnUrl: 'https://shannonchapoy.com/specials/intake'
    }),
    '/store/payment-return/intake?locale=en&currency=USD&payment=expired&returnUrl=https%3A%2F%2Fshannonchapoy.com%2Fspecials%2Fintake'
  )
})

test('successful payments use the same branded result route', () => {
  assert.equal(
    checkoutReturnPath({ slug: 'intake', locale: 'en', currency: 'USD', outcome: 'success' }),
    '/store/payment-return/intake?locale=en&currency=USD&payment=success'
  )
})

test('successful payments return to the host thank-you route', () => {
  assert.equal(
    hostThankYouUrl({
      returnUrl: 'https://shannonchapoy.com/specials/intake?source=checkout#details',
      slug: 'intake',
      locale: 'nl',
      currency: 'USD',
      bookingReference: 'BK-7F3A9C12D4E8'
    }),
    'https://shannonchapoy.com/thank-you/intake?locale=nl&currency=USD&reference=BK-7F3A9C12D4E8'
  )
  assert.equal(
    hostThankYouUrl({
      returnUrl: 'javascript:alert(1)',
      slug: 'intake',
      locale: 'en',
      currency: 'EUR',
      bookingReference: 'BK-7F3A9C12D4E8'
    }),
    undefined
  )
})
