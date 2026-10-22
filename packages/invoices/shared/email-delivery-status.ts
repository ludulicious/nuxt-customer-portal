export const knownEmailProviderEvents = [
  'sent',
  'delivered',
  'delivery_delayed',
  'bounced',
  'failed',
  'suppressed',
  'complained',
  'opened',
  'clicked'
] as const

export type KnownEmailProviderEvent = (typeof knownEmailProviderEvents)[number]

export const normalizeEmailProviderEvent = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .replace(/^email\./, '')
    .replaceAll('-', '_')

export const isKnownEmailProviderEvent = (value: string): value is KnownEmailProviderEvent =>
  knownEmailProviderEvents.includes(value as KnownEmailProviderEvent)

type EmailStatusRefreshState = {
  providerMessageId: string | null
  providerLastEvent: string | null
  providerStatusCheckedAt: Date | string | null
  sentAt: Date | string | null
  createdAt: Date | string
}

const MINUTE_MS = 60_000
const DAY_MS = 24 * 60 * MINUTE_MS
const completedDeliveryEvents = new Set([
  'delivered',
  'opened',
  'clicked',
  'bounced',
  'failed',
  'suppressed',
  'complained'
])

export const shouldRefreshInvoiceEmailStatus = (
  delivery: EmailStatusRefreshState,
  forceRefresh = false,
  now = Date.now()
): boolean => {
  if (!delivery.providerMessageId) {
    return false
  }
  // Delivery is resolved; later engagement/complaint events can still be requested manually.
  if (!forceRefresh && completedDeliveryEvents.has(normalizeEmailProviderEvent(delivery.providerLastEvent || ''))) {
    return false
  }
  const age = now - new Date(delivery.sentAt || delivery.createdAt).getTime()
  const interval = forceRefresh
    ? MINUTE_MS
    : age >= 7 * DAY_MS
      ? DAY_MS
      : age >= DAY_MS
        ? 60 * MINUTE_MS
        : 5 * MINUTE_MS
  return !delivery.providerStatusCheckedAt || now - new Date(delivery.providerStatusCheckedAt).getTime() >= interval
}
