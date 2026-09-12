import type { Locale } from '../../shared/types'

export type CheckoutReturnOutcome = 'success' | 'cancelled' | 'failed' | 'expired'

export function checkoutReturnPath(input: {
  slug: string
  locale: Locale
  currency: string
  outcome: CheckoutReturnOutcome
  returnUrl?: string
  bookingReference?: string
}) {
  const query = new URLSearchParams({
    locale: input.locale,
    currency: input.currency,
    payment: input.outcome
  })
  if (input.returnUrl) {
    query.set('returnUrl', input.returnUrl)
  }
  if (input.bookingReference) {
    query.set('reference', input.bookingReference)
  }
  return `/store/payment-return/${encodeURIComponent(input.slug)}?${query.toString()}`
}

export function hostThankYouUrl(input: {
  returnUrl?: string
  slug: string
  locale: Locale
  currency: string
  bookingReference: string
}) {
  if (!input.returnUrl) {
    return undefined
  }
  try {
    const url = new URL(input.returnUrl)
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
      return undefined
    }
    url.pathname = `/thank-you/${encodeURIComponent(input.slug)}`
    url.search = new URLSearchParams({
      locale: input.locale,
      currency: input.currency,
      reference: input.bookingReference
    }).toString()
    url.hash = ''
    return url.toString()
  } catch {
    return undefined
  }
}
