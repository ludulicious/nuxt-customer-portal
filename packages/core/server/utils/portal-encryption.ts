import { createCipheriv, createDecipheriv, createHash, hkdfSync, randomBytes } from 'node:crypto'

export type PortalEncryptionOverride = {
  env: string
  format: 'sha256' | 'base64-32'
}

export type PortalEncryptionOptions = {
  purpose: string
  overrides?: PortalEncryptionOverride[]
}

const VERSION = 'v2'
const ROOT_KEY_ENV = 'PORTAL_ENCRYPTION_KEY'

const decodeBase64Key = (value: string, name: string) => {
  const normalized = value.trim()
  if (!/^[A-Za-z0-9+/_-]+={0,2}$/.test(normalized)) {
    throw new Error(`${name} must be a base64-encoded 32-byte key`)
  }
  const key = Buffer.from(normalized, normalized.includes('-') || normalized.includes('_') ? 'base64url' : 'base64')
  if (key.length !== 32) {
    throw new Error(`${name} must be a base64-encoded 32-byte key`)
  }
  return key
}

const overrideKey = (override: PortalEncryptionOverride) => {
  const value = process.env[override.env]
  if (!value) {
    return null
  }
  return override.format === 'sha256'
    ? createHash('sha256').update(value).digest()
    : decodeBase64Key(value, override.env)
}

const configuredOverride = (overrides: PortalEncryptionOverride[] = []) => {
  for (const override of overrides) {
    const key = overrideKey(override)
    if (key) {
      return { key, source: override.env }
    }
  }
  return null
}

const missingKeyMessage = (overrides: PortalEncryptionOverride[] = []) => {
  const names = [ROOT_KEY_ENV, ...overrides.map(({ env }) => env)]
  return `Configure ${names.join(' or ')}`
}

const resolvePortalEncryptionMaterial = ({ purpose, overrides = [] }: PortalEncryptionOptions) => {
  const override = configuredOverride(overrides)
  if (override) {
    return override
  }

  const rootValue = process.env.PORTAL_ENCRYPTION_KEY
  if (!rootValue) {
    throw new Error(missingKeyMessage(overrides))
  }
  const rootKey = decodeBase64Key(rootValue, ROOT_KEY_ENV)
  return {
    key: Buffer.from(hkdfSync('sha256', rootKey, Buffer.alloc(0), `nuxt-customer-portal:${purpose}`, 32)),
    source: ROOT_KEY_ENV
  }
}

export const resolvePortalEncryptionKey = (options: PortalEncryptionOptions) =>
  resolvePortalEncryptionMaterial(options).key

const materialForSource = (source: string, options: PortalEncryptionOptions) => {
  if (source === ROOT_KEY_ENV) {
    const rootValue = process.env.PORTAL_ENCRYPTION_KEY
    if (!rootValue) {
      throw new Error(`Configure ${ROOT_KEY_ENV} to decrypt this credential`)
    }
    const rootKey = decodeBase64Key(rootValue, ROOT_KEY_ENV)
    return Buffer.from(hkdfSync('sha256', rootKey, Buffer.alloc(0), `nuxt-customer-portal:${options.purpose}`, 32))
  }
  const override = options.overrides?.find(({ env }) => env === source)
  if (!override) {
    throw new Error('Stored credential uses an unsupported encryption key source')
  }
  const key = overrideKey(override)
  if (!key) {
    throw new Error(`Configure ${source} to decrypt this credential`)
  }
  return key
}

const associatedData = (purpose: string, source: string) =>
  Buffer.from(`nuxt-customer-portal:${VERSION}:${purpose}:${source}`)

export const encryptPortalSecret = (value: string, options: PortalEncryptionOptions) => {
  const iv = randomBytes(12)
  const { key, source } = resolvePortalEncryptionMaterial(options)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  cipher.setAAD(associatedData(options.purpose, source))
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()])
  return [
    VERSION,
    Buffer.from(options.purpose).toString('base64url'),
    Buffer.from(source).toString('base64url'),
    iv.toString('base64url'),
    cipher.getAuthTag().toString('base64url'),
    encrypted.toString('base64url')
  ].join('.')
}

export const isPortalSecretCiphertext = (value: string) => value.startsWith(`${VERSION}.`)

export const decryptPortalSecret = (value: string, options: PortalEncryptionOptions) => {
  const [version, encodedPurpose, encodedSource, iv, tag, encrypted] = value.split('.')
  if (version !== VERSION || !encodedPurpose || !encodedSource || !iv || !tag || !encrypted) {
    throw new Error('Stored credential has an invalid encryption format')
  }
  const purpose = Buffer.from(encodedPurpose, 'base64url').toString('utf8')
  if (purpose !== options.purpose) {
    throw new Error('Stored credential belongs to a different encryption purpose')
  }
  const source = Buffer.from(encodedSource, 'base64url').toString('utf8')
  const key = materialForSource(source, options)
  try {
    const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'base64url'))
    decipher.setAAD(associatedData(options.purpose, source))
    decipher.setAuthTag(Buffer.from(tag, 'base64url'))
    return Buffer.concat([decipher.update(Buffer.from(encrypted, 'base64url')), decipher.final()]).toString('utf8')
  } catch {
    throw new Error('Stored credential could not be decrypted')
  }
}

const requireLegacyOverrideKey = (overrides: PortalEncryptionOverride[]) => {
  const material = configuredOverride(overrides)
  if (material) {
    return material.key
  }
  throw new Error(`Retain ${overrides.map(({ env }) => env).join(' or ')} to decrypt legacy credentials`)
}

export const decryptLegacyDotSecret = (value: string, overrides: PortalEncryptionOverride[]) => {
  const [version, iv, tag, encrypted] = value.split('.')
  if (version !== 'v1' || !iv || !tag || !encrypted) {
    throw new Error('Stored credential has an invalid encryption format')
  }
  const key = requireLegacyOverrideKey(overrides)
  try {
    const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'base64url'))
    decipher.setAuthTag(Buffer.from(tag, 'base64url'))
    return Buffer.concat([decipher.update(Buffer.from(encrypted, 'base64url')), decipher.final()]).toString('utf8')
  } catch {
    throw new Error('Stored credential could not be decrypted')
  }
}

export const decryptLegacyBinarySecret = (value: string, overrides: PortalEncryptionOverride[]) => {
  const bytes = Buffer.from(value, 'base64')
  if (bytes.length < 29) {
    throw new Error('Stored credential has an invalid encryption format')
  }
  const key = requireLegacyOverrideKey(overrides)
  try {
    const decipher = createDecipheriv('aes-256-gcm', key, bytes.subarray(0, 12))
    decipher.setAuthTag(bytes.subarray(12, 28))
    return Buffer.concat([decipher.update(bytes.subarray(28)), decipher.final()]).toString('utf8')
  } catch {
    throw new Error('Stored credential could not be decrypted')
  }
}
