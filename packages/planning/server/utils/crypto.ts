import { randomBytes, createHash } from 'node:crypto'
import {
  decryptLegacyBinarySecret,
  decryptPortalSecret,
  encryptPortalSecret,
  isPortalSecretCiphertext
} from '@nuxt-customer-portal/core/server/utils/portal-encryption'

export const digest = (value: string) => createHash('sha256').update(value).digest('hex')
export const secret = () => randomBytes(32).toString('base64url')
const planningEncryption = {
  purpose: 'planning/oauth',
  overrides: [{ env: 'PLANNING_ENCRYPTION_KEY', format: 'base64-32' as const }]
}
export function encrypt(value: unknown) {
  return encryptPortalSecret(JSON.stringify(value), planningEncryption)
}
export function decrypt<T>(value: string): T {
  const decrypted = isPortalSecretCiphertext(value)
    ? decryptPortalSecret(value, planningEncryption)
    : decryptLegacyBinarySecret(value, planningEncryption.overrides)
  return JSON.parse(decrypted) as T
}
