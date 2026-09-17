import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto'
import Stripe from 'stripe'
import { createError } from 'h3'
import { rows } from './database'
import type { StripeSettings } from '../../shared/types'

interface StripeRow {
  stripe_secret_key: string | null
  stripe_webhook_secret: string | null
  stripe_tested_at: string | null
}

const encryptionKey = () => {
  const value = process.env.PRODUCTS_STRIPE_ENCRYPTION_KEY || process.env.PRODUCTS_STORAGE_ENCRYPTION_KEY
  if (!value) {
    throw createError({
      statusCode: 503,
      message: 'Configure PRODUCTS_STRIPE_ENCRYPTION_KEY or PRODUCTS_STORAGE_ENCRYPTION_KEY'
    })
  }
  return createHash('sha256').update(value).digest()
}

export const encryptStripeSecret = (value: string) => {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv)
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()])
  return [
    'v1',
    iv.toString('base64url'),
    cipher.getAuthTag().toString('base64url'),
    encrypted.toString('base64url')
  ].join('.')
}

export const decryptStripeSecret = (value: string) => {
  const [version, iv, tag, encrypted] = value.split('.')
  if (version !== 'v1' || !iv || !tag || !encrypted) {
    throw new Error('Stored Stripe credential has an invalid format')
  }
  try {
    const decipher = createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(iv, 'base64url'))
    decipher.setAuthTag(Buffer.from(tag, 'base64url'))
    return Buffer.concat([decipher.update(Buffer.from(encrypted, 'base64url')), decipher.final()]).toString('utf8')
  } catch {
    throw new Error('Stored Stripe credential could not be decrypted')
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
