import { z } from 'zod'

export const thankYouCopySchema = z.object({
  statusLabel: z.string().trim().min(1).max(120),
  heading: z.string().trim().min(1).max(240),
  message: z.string().trim().min(1).max(4000),
  helpText: z.string().trim().max(2000),
  downloadsHeading: z.string().trim().min(1).max(120)
})
export type ThankYouCopy = z.infer<typeof thankYouCopySchema>
export type ThankYouVariant = 'free' | 'paid'

export function purchaseThankYouVariant(order: {
  total: number | null
  lines: Array<{ unit_amount: number }>
}): ThankYouVariant {
  return order.total === 0 ||
    (order.total === null && order.lines.length > 0 && order.lines.every((line) => line.unit_amount === 0))
    ? 'free'
    : 'paid'
}

export const thankYouOverrideSchema = z
  .object({
    statusLabel: z.string().trim().max(120).optional(),
    heading: z.string().trim().max(240).optional(),
    message: z.string().trim().max(4000).optional(),
    helpText: z.string().trim().max(2000).optional(),
    downloadsHeading: z.string().trim().max(120).optional()
  })
  .strict()
export type ThankYouOverride = z.infer<typeof thankYouOverrideSchema>
export const thankYouTargetSchema = z
  .object({
    productSlug: z.string().trim().max(200).default(''),
    locale: z.enum(['en', 'nl']),
    variant: z.enum(['free', 'paid'])
  })
  .strict()
export const saveThankYouSchema = thankYouTargetSchema.extend({ copy: thankYouOverrideSchema })
export type ThankYouText = z.infer<typeof saveThankYouSchema>

export function defaultThankYouCopy(variant: ThankYouVariant, locale: 'en' | 'nl'): ThankYouCopy {
  return locale === 'nl'
    ? {
        statusLabel: 'Bestelling ontvangen',
        heading: variant === 'free' ? 'Je cadeau staat voor je klaar' : 'Bedankt voor je bestelling',
        message: variant === 'free' ? 'Bedankt dat je deze stap voor jezelf zet.' : 'Je bestelling is ontvangen.',
        helpText: 'Je kunt je bestelling en de volgende stappen in het portaal bekijken.',
        downloadsHeading: 'Je downloads'
      }
    : {
        statusLabel: 'Order received',
        heading: variant === 'free' ? 'Your gift is ready' : 'Thank you for your order',
        message: variant === 'free' ? 'Thank you for taking this step for yourself.' : 'Your order has been received.',
        helpText: 'You can review your order and next steps in the portal.',
        downloadsHeading: 'Your downloads'
      }
}

export function resolveThankYouCopy(
  entries: ThankYouText[],
  slug: string,
  variant: ThankYouVariant,
  locale: 'en' | 'nl'
): ThankYouCopy {
  const copy = defaultThankYouCopy(variant, locale)
  for (const productSlug of new Set(['', slug])) {
    const entry = entries.find(
      (item) => item.productSlug === productSlug && item.variant === variant && item.locale === locale
    )
    if (!entry) {
      continue
    }
    for (const key of Object.keys(copy) as Array<keyof ThankYouCopy>) {
      const value = entry.copy[key]?.trim()
      if (value) {
        copy[key] = value
      }
    }
  }
  return copy
}
