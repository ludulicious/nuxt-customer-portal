import assert from 'node:assert/strict'
import test from 'node:test'
import {
  decryptStripeSecret,
  encryptStripeSecret,
  environmentStripeManaged
} from '../server/utils/stripe-configuration'

test('stored Stripe secrets are authenticated, encrypted, and key-bound', () => {
  process.env.PRODUCTS_STRIPE_ENCRYPTION_KEY = 'first-products-stripe-encryption-key'
  const encrypted = encryptStripeSecret('sk_test_super_secret')
  assert.notEqual(encrypted, 'sk_test_super_secret')
  assert.equal(decryptStripeSecret(encrypted), 'sk_test_super_secret')
  assert.throws(() => decryptStripeSecret(`${encrypted.slice(0, -1)}x`), /could not be decrypted/)
  process.env.PRODUCTS_STRIPE_ENCRYPTION_KEY = 'second-products-stripe-encryption-key'
  assert.throws(() => decryptStripeSecret(encrypted), /could not be decrypted/)
  delete process.env.PRODUCTS_STRIPE_ENCRYPTION_KEY
})

test('any environment Stripe credential makes store configuration environment-managed', () => {
  delete process.env.PRODUCTS_STRIPE_SECRET_KEY
  delete process.env.PRODUCTS_STRIPE_WEBHOOK_SECRET
  assert.equal(environmentStripeManaged(), false)
  process.env.PRODUCTS_STRIPE_SECRET_KEY = 'sk_test_environment'
  assert.equal(environmentStripeManaged(), true)
  delete process.env.PRODUCTS_STRIPE_SECRET_KEY
  process.env.PRODUCTS_STRIPE_WEBHOOK_SECRET = 'whsec_environment'
  assert.equal(environmentStripeManaged(), true)
  delete process.env.PRODUCTS_STRIPE_WEBHOOK_SECRET
})
