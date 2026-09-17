import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'node:crypto'

export const digest = (value: string) => createHash('sha256').update(value).digest('hex')
export const secret = () => randomBytes(32).toString('base64url')
function key() {
  const value = Buffer.from(process.env.PLANNING_ENCRYPTION_KEY || '', 'base64')
  if (value.length !== 32) {
    throw new Error('Configure PLANNING_ENCRYPTION_KEY with a base64-encoded 32-byte key')
  }
  return value
}
export function encrypt(value: unknown) {
  const iv = randomBytes(12),
    cipher = createCipheriv('aes-256-gcm', key(), iv)
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(value)), cipher.final()])
  return Buffer.concat([iv, cipher.getAuthTag(), ciphertext]).toString('base64')
}
export function decrypt<T>(value: string): T {
  const bytes = Buffer.from(value, 'base64'),
    cipher = createDecipheriv('aes-256-gcm', key(), bytes.subarray(0, 12))
  cipher.setAuthTag(bytes.subarray(12, 28))
  return JSON.parse(Buffer.concat([cipher.update(bytes.subarray(28)), cipher.final()]).toString()) as T
}
