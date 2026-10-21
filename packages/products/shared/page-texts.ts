import { z } from 'zod'

const text = (max: number) => z.string().trim().max(max)
export const orderPageCopySchema = z
  .object({
    eyebrow: text(240),
    title: text(240),
    dateLabel: text(240),
    totalLabel: text(240),
    instructionsHeading: text(240),
    downloadLabel: text(240),
    openLinkLabel: text(240),
    previewVideoLabel: text(240),
    externalVideoHelp: text(1000),
    filePlaybackFailed: text(1000),
    externalPlaybackFailed: text(1000),
    filesPreparing: text(1000),
    refreshLabel: text(240),
    loadingText: text(240),
    pendingHeading: text(240),
    pendingText: text(4000),
    accessHeading: text(240),
    accessText: text(4000),
    itemRevokedText: text(1000),
    invoiceHelp: text(4000),
    unavailableTitle: text(240),
    unavailableText: text(4000),
    errorTitle: text(240),
    errorText: text(4000),
    footer: text(4000),
    statusPending: text(240),
    statusAccepted: text(240),
    statusPaid: text(240),
    statusFailed: text(1000),
    statusExpired: text(240),
    statusRevoked: text(240),
    content: text(12000)
  })
  .strict()
export const orderPageOverrideSchema = orderPageCopySchema.partial()
export type OrderPageOverride = z.infer<typeof orderPageOverrideSchema>
export type OrderPageCopy = z.infer<typeof orderPageCopySchema> & { contentHtml?: string }
export const pageTextTargetSchema = z
  .object({
    page: z.literal('order-details'),
    locale: z.enum(['en', 'nl']),
    productSlug: z.string().trim().max(200).default('')
  })
  .strict()
export const savePageTextSchema = pageTextTargetSchema
  .extend({ copy: orderPageOverrideSchema })
  .superRefine((entry, ctx) => {
    if (entry.productSlug && Object.keys(entry.copy).some((key) => key !== 'content')) {
      ctx.addIssue({
        code: 'custom',
        path: ['copy'],
        message: 'Only the purchase introduction can be customized per product'
      })
    }
  })
export type PageText = z.infer<typeof savePageTextSchema>

const defaults: Record<'en' | 'nl', z.infer<typeof orderPageCopySchema>> = {
  en: {
    eyebrow: 'Order details',
    title: 'Your order',
    dateLabel: 'Purchase date',
    totalLabel: 'Price',
    instructionsHeading: 'Instructions after purchase',
    downloadLabel: 'Download',
    openLinkLabel: 'Open link',
    previewVideoLabel: 'Preview video',
    externalVideoHelp: 'If the video cannot play here, use Open link to watch it on the original service.',
    filePlaybackFailed: 'This file cannot play in your browser. You can still download it.',
    externalPlaybackFailed: 'Playback is unavailable. Use Open link to access the original media.',
    filesPreparing: 'Some files are not ready yet. Please check again in a moment.',
    refreshLabel: 'Refresh',
    loadingText: 'Loading…',
    pendingHeading: 'Your order is awaiting confirmation',
    pendingText: 'Your files and links will appear here once your order is confirmed.',
    accessHeading: 'Your purchased content is unavailable',
    accessText:
      'This order does not currently have access to its files and links. Contact the seller if you need help.',
    itemRevokedText: 'Access to this item is no longer available.',
    invoiceHelp: 'Your order is confirmed immediately. An invoice will follow separately.',
    unavailableTitle: 'This order link is unavailable',
    unavailableText: 'Check the link in your confirmation email, or contact the seller for help.',
    errorTitle: 'Your order could not be loaded',
    errorText: 'Please try again in a moment.',
    footer:
      'Keep this link private. Anyone with it can view your order and access available content. No portal account is needed.',
    statusPending: 'Pending payment',
    statusAccepted: 'Accepted · awaiting payment',
    statusPaid: 'Paid',
    statusFailed: 'Failed',
    statusExpired: 'Expired',
    statusRevoked: 'Access ended following a refund.',
    content: ''
  },
  nl: {
    eyebrow: 'Bestelgegevens',
    title: 'Je bestelling',
    dateLabel: 'Aankoopdatum',
    totalLabel: 'Prijs',
    instructionsHeading: 'Instructies na aankoop',
    downloadLabel: 'Downloaden',
    openLinkLabel: 'Link openen',
    previewVideoLabel: 'Video bekijken',
    externalVideoHelp:
      'Kan de video hier niet afspelen? Gebruik Link openen om deze bij de oorspronkelijke dienst te bekijken.',
    filePlaybackFailed: 'Dit bestand kan niet in je browser worden afgespeeld. Je kunt het wel downloaden.',
    externalPlaybackFailed:
      'Afspelen is niet beschikbaar. Gebruik Link openen om de oorspronkelijke media te bekijken.',
    filesPreparing: 'Sommige bestanden zijn nog niet gereed. Probeer het over een ogenblik opnieuw.',
    refreshLabel: 'Vernieuwen',
    loadingText: 'Laden…',
    pendingHeading: 'Je bestelling wacht op bevestiging',
    pendingText: 'Je bestanden en links verschijnen hier zodra je bestelling is bevestigd.',
    accessHeading: 'Je aangekochte inhoud is niet beschikbaar',
    accessText:
      'Deze bestelling heeft momenteel geen toegang tot de bestanden en links. Neem contact op met de verkoper als je hulp nodig hebt.',
    itemRevokedText: 'Toegang tot dit onderdeel is niet meer beschikbaar.',
    invoiceHelp: 'Je bestelling wordt direct bevestigd. Je ontvangt de factuur later apart.',
    unavailableTitle: 'Deze bestellink is niet beschikbaar',
    unavailableText: 'Controleer de link in je bevestigingsmail of neem contact op met de verkoper.',
    errorTitle: 'Je bestelling kon niet worden geladen',
    errorText: 'Probeer het over een ogenblik opnieuw.',
    footer:
      'Houd deze link privé. Iedereen met de link kan je bestelling bekijken en beschikbare inhoud openen. Je hebt geen portaalaccount nodig.',
    statusPending: 'Wacht op betaling',
    statusAccepted: 'Bevestigd · wacht op betaling',
    statusPaid: 'Betaald',
    statusFailed: 'Mislukt',
    statusExpired: 'Verlopen',
    statusRevoked: 'Toegang beëindigd na terugbetaling.',
    content: ''
  }
}
export function defaultOrderPageCopy(locale: 'en' | 'nl'): OrderPageCopy {
  return { ...defaults[locale] }
}
export function resolveOrderPageCopy(overrides: OrderPageOverride | undefined, locale: 'en' | 'nl'): OrderPageCopy {
  const copy = defaultOrderPageCopy(locale)
  for (const key of Object.keys(defaults[locale]) as Array<keyof OrderPageOverride>) {
    const value = overrides?.[key]?.trim()
    if (value) {
      copy[key] = value
    }
  }
  return copy
}
export function resolveProductOrderPageCopy(
  entries: PageText[],
  productSlug: string,
  locale: 'en' | 'nl'
): OrderPageCopy {
  const store = resolveOrderPageCopy(
    entries.find((entry) => !entry.productSlug && entry.locale === locale)?.copy,
    locale
  )
  const product = entries.find((entry) => entry.productSlug === productSlug && entry.locale === locale)?.copy
  return product?.content?.trim() ? { ...store, content: product.content.trim() } : store
}
export const orderPageTextGroups = [
  { id: 'welcome', fields: ['eyebrow', 'title', 'content'] },
  { id: 'order', fields: ['dateLabel', 'totalLabel', 'instructionsHeading', 'invoiceHelp'] },
  {
    id: 'media',
    fields: [
      'downloadLabel',
      'openLinkLabel',
      'previewVideoLabel',
      'externalVideoHelp',
      'filePlaybackFailed',
      'externalPlaybackFailed',
      'filesPreparing',
      'refreshLabel',
      'loadingText'
    ]
  },
  {
    id: 'status',
    fields: ['statusPending', 'statusAccepted', 'statusPaid', 'statusFailed', 'statusExpired', 'statusRevoked']
  },
  { id: 'access', fields: ['pendingHeading', 'pendingText', 'accessHeading', 'accessText', 'itemRevokedText'] },
  { id: 'errors', fields: ['unavailableTitle', 'unavailableText', 'errorTitle', 'errorText'] },
  { id: 'footer', fields: ['footer'] }
] as const
