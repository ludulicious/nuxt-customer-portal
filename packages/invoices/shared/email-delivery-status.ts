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
