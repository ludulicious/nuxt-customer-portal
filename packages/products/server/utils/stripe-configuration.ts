import Stripe from 'stripe'
import { createError } from 'h3'
import {
  decryptLegacyDotSecret,
  decryptPortalSecret,
  encryptPortalSecret,
  isPortalSecretCiphertext
} from '@nuxt-customer-portal/core/server/utils/portal-encryption'
import { rows } from './database'
import type { StripeSettings } from '../../shared/types'

interface StripeRow {
  stripe_secret_key: string | null
  stripe_webhook_secret: string | null
  stripe_tested_at: string | null
}

const stripeEncryption = {
  purpose: 'products/stripe',
  overrides: [
    { env: 'PRODUCTS_STRIPE_ENCRYPTION_KEY', format: 'sha256' as const },
    { env: 'PRODUCTS_STORAGE_ENCRYPTION_KEY', format: 'sha256' as const }
  ]
}

export const encryptStripeSecret = (value: string) => encryptPortalSecret(value, stripeEncryption)

export const decryptStripeSecret = (value: string) => {
  try {
    return isPortalSecretCiphertext(value)
      ? decryptPortalSecret(value, stripeEncryption)
      : decryptLegacyDotSecret(value, stripeEncryption.overrides)
  } catch (error) {
    if (error instanceof Error && (/^Configure /.test(error.message) || /^Retain /.test(error.message))) {
      throw error
    }
    throw new Error('Stored Stripe credential could not be decrypted', { cause: error })
  }
}

export const environmentStripeManaged = () =>
  Boolean(process.env.PRODUCTS_STRIPE_SECRET_KEY || process.env.PRODUCTS_STRIPE_WEBHOOK_SECRET)

const storedStripe = async () => {
  const [row] = await rows<StripeRow>(
    'SELECT stripe_secret_key,stripe_webhook_secret,stripe_tested_at FROM products.store WHERE id=true'
  )
  return row
}

export const resolveStripeConfiguration = async () => {
  if (environmentStripeManaged()) {
    if (!process.env.PRODUCTS_STRIPE_SECRET_KEY) {
      throw createError({ statusCode: 503, message: 'Configure PRODUCTS_STRIPE_SECRET_KEY' })
    }
    return {
      secretKey: process.env.PRODUCTS_STRIPE_SECRET_KEY,
      webhookSecret: process.env.PRODUCTS_STRIPE_WEBHOOK_SECRET || '',
      source: 'environment' as const
    }
  }
  const row = await storedStripe()
  if (!row?.stripe_secret_key) {
    throw createError({ statusCode: 503, message: 'Configure Stripe before opening checkout' })
  }
  return {
    secretKey: decryptStripeSecret(row.stripe_secret_key),
    webhookSecret: row.stripe_webhook_secret ? decryptStripeSecret(row.stripe_webhook_secret) : '',
    source: 'store' as const
  }
}

export const stripeSummary = async (): Promise<StripeSettings> => {
  if (environmentStripeManaged()) {
    return {
      source: 'environment',
      configured: Boolean(process.env.PRODUCTS_STRIPE_SECRET_KEY),
      webhookConfigured: Boolean(process.env.PRODUCTS_STRIPE_WEBHOOK_SECRET),
      tested: Boolean(process.env.PRODUCTS_STRIPE_SECRET_KEY),
      secretKeySuffix: process.env.PRODUCTS_STRIPE_SECRET_KEY?.slice(-4) || ''
    }
  }
  const row = await storedStripe()
  return {
    source: row?.stripe_secret_key ? 'store' : 'missing',
    configured: Boolean(row?.stripe_secret_key),
    webhookConfigured: Boolean(row?.stripe_webhook_secret),
    tested: Boolean(row?.stripe_tested_at),
    secretKeySuffix: row?.stripe_secret_key ? decryptStripeSecret(row.stripe_secret_key).slice(-4) : ''
  }
}

export const testStripeSecretKey = async (secretKey: string) => {
  const stripe = new Stripe(secretKey)
  return await stripe.accounts.retrieve()
}
