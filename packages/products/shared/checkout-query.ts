import { productCurrencies } from './validation'
import type { Locale } from './types'

export function resolveCheckoutQuery(query: Record<string, unknown>) {
  const locale: Locale = query.locale === 'nl' ? 'nl' : 'en'
  const requestedCurrency = typeof query.currency === 'string' ? query.currency.toUpperCase() : ''
  const currency = (productCurrencies as readonly string[]).includes(requestedCurrency) ? requestedCurrency : undefined
  return { locale, currency }
}

export function resolveProductReturnUrl(candidate: unknown, portalOrigin: string) {
  if (typeof candidate !== 'string' || !candidate || candidate.length > 2000) {
    return undefined
  }
  try {
    const url = new URL(candidate)
    if (
      ['http:', 'https:'].includes(url.protocol) &&
      url.origin === new URL(portalOrigin).origin &&
      !url.username &&
      !url.password &&
      /^\/admin\/products\/[a-zA-Z0-9-]+$/.test(url.pathname)
    ) {
      return url.href
    }
  } catch {
    return undefined
  }
  return undefined
}

export function resolveCheckoutReturnUrl(candidate: unknown, configuredReturnUrl: string, portalOrigin = '') {
  const productReturnUrl = resolveProductReturnUrl(candidate, portalOrigin)
  if (productReturnUrl) {
    return productReturnUrl
  }
  if (typeof candidate !== 'string' || !candidate || candidate.length > 2000) {
    return configuredReturnUrl
  }
  try {
    const candidateUrl = new URL(candidate)
    const configuredUrl = new URL(configuredReturnUrl)
    const isLocalDevelopment = ['localhost', '127.0.0.1', '::1'].includes(candidateUrl.hostname)
    if (
      !['http:', 'https:'].includes(candidateUrl.protocol) ||
      candidateUrl.username ||
      candidateUrl.password ||
      (candidateUrl.origin !== configuredUrl.origin && !isLocalDevelopment)
    ) {
      return configuredReturnUrl
    }
    return candidateUrl.toString()
  } catch {
    return configuredReturnUrl
  }
}
