import assert from 'node:assert/strict'
import test from 'node:test'
import {
  decryptStripeSecret,
  encryptStripeSecret,
  environmentStripeManaged
} from '../server/utils/stripe-configuration'

const tamperAuthenticationTag = (value: string) => {
  const parts = value.split('.')
  parts[4] = `${parts[4]!.startsWith('A') ? 'B' : 'A'}${parts[4]!.slice(1)}`
  return parts.join('.')
}

test('stored Stripe secrets are authenticated, encrypted, and key-bound', () => {
  const originalRoot = process.env.PORTAL_ENCRYPTION_KEY
  const originalStripe = process.env.PRODUCTS_STRIPE_ENCRYPTION_KEY
  const originalStorage = process.env.PRODUCTS_STORAGE_ENCRYPTION_KEY
  delete process.env.PRODUCTS_STRIPE_ENCRYPTION_KEY
  delete process.env.PRODUCTS_STORAGE_ENCRYPTION_KEY
  process.env.PORTAL_ENCRYPTION_KEY = Buffer.alloc(32, 4).toString('base64')
  try {
    const encrypted = encryptStripeSecret('sk_test_super_secret')
    assert.notEqual(encrypted, 'sk_test_super_secret')
    assert.equal(decryptStripeSecret(encrypted), 'sk_test_super_secret')
    assert.throws(() => decryptStripeSecret(tamperAuthenticationTag(encrypted)), /could not be decrypted/)
  } finally {
    if (originalRoot === undefined) delete process.env.PORTAL_ENCRYPTION_KEY
    else process.env.PORTAL_ENCRYPTION_KEY = originalRoot
    if (originalStripe === undefined) delete process.env.PRODUCTS_STRIPE_ENCRYPTION_KEY
    else process.env.PRODUCTS_STRIPE_ENCRYPTION_KEY = originalStripe
    if (originalStorage === undefined) delete process.env.PRODUCTS_STORAGE_ENCRYPTION_KEY
    else process.env.PRODUCTS_STORAGE_ENCRYPTION_KEY = originalStorage
  }
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
