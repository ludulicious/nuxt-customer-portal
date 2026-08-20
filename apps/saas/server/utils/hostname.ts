import { domainToASCII } from 'node:url'

export const normalizeHostname = (value: string) => {
  const withoutPort = value.trim().replace(/\.$/, '').replace(/^\[([^\]]+)](?::\d+)?$/, '$1').replace(/:\d+$/, '')
  const normalized = domainToASCII(withoutPort).toLowerCase()
  if (!normalized || normalized.length > 253 || normalized.includes('..')) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid hostname' })
  }
  return normalized
}
