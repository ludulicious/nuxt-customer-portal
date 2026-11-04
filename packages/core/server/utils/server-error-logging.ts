import type { H3Event } from 'h3'
import { PortalEncryptionConfigurationError } from './portal-encryption'

const diagnostics: Record<string, string> = {
  '42P01': 'Database table is missing; check package migrations',
  '42703': 'Database column is missing; check package migrations',
  '23503': 'Database foreign-key constraint failed',
  '23505': 'Database unique constraint failed',
  '42501': 'Database permissions are insufficient',
  '28P01': 'Database authentication failed',
  ECONNREFUSED: 'A required service refused the connection',
  ETIMEDOUT: 'A required service timed out',
  ENOTFOUND: 'A required service hostname could not be resolved'
}

const record = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' ? (value as Record<string, unknown>) : {}

const diagnostic = (error: unknown) => {
  let current = error
  for (let depth = 0; depth < 6; depth++) {
    if (current instanceof PortalEncryptionConfigurationError) {
      return { code: 'PORTAL_ENCRYPTION_CONFIGURATION', message: current.message }
    }
    const { code, cause } = record(current)
    if (typeof code === 'string' && Object.hasOwn(diagnostics, code)) {
      return { code, message: diagnostics[code] }
    }
    current = cause
  }
  return { code: 'SERVER_ERROR', message: 'Unexpected server error' }
}

export const logPortalServerError = (
  error: unknown,
  event?: H3Event,
  write: (message: string) => void = console.error
) => {
  const value = record(error).statusCode
  const statusCode = typeof value === 'number' && value >= 400 && value <= 599 ? value : 500
  if (statusCode < 500) {
    return
  }
  write(
    JSON.stringify({
      event: 'portal.server_error',
      method: event?.method ?? null,
      path: event?.path.split('?')[0] ?? null,
      statusCode,
      ...diagnostic(error)
    })
  )
}
