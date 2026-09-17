import assert from 'node:assert/strict'
import test from 'node:test'
import { checkoutReturnPath } from '../server/utils/checkout-return'

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

test('successful payment returns retain the originating offer and booking reference', () => {
  assert.equal(
    checkoutReturnPath({
      returnUrl: 'https://shannonchapoy.com/specials/intake?source=checkout#details',
      slug: 'intake',
      locale: 'nl',
      currency: 'USD',
      outcome: 'success',
      bookingReference: 'BK-7F3A9C12D4E8'
    }),
    '/store/payment-return/intake?locale=nl&currency=USD&payment=success&returnUrl=https%3A%2F%2Fshannonchapoy.com%2Fspecials%2Fintake%3Fsource%3Dcheckout%23details&reference=BK-7F3A9C12D4E8'
  )
})
