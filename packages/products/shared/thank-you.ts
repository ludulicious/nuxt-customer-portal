import { z } from 'zod'

export const thankYouCopySchema = z.object({
  statusLabel: z.string().trim().min(1).max(120),
  heading: z.string().trim().min(1).max(240),
  message: z.string().trim().min(1).max(4000),
  helpText: z.string().trim().max(2000),
  downloadsHeading: z.string().trim().min(1).max(120),
  content: z.string().trim().max(12000).optional()
})
export type ThankYouCopy = z.infer<typeof thankYouCopySchema> & { contentHtml?: string }
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
    content: z.string().trim().max(12000).optional(),
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
        helpText: 'Je ontvangt een e-mail met je bestellink, zodat je hier altijd kunt terugkomen.',
        downloadsHeading: 'Je bestanden en links'
      }
    : {
        statusLabel: 'Order received',
        heading: variant === 'free' ? 'Your gift is ready' : 'Thank you for your order',
        message: variant === 'free' ? 'Thank you for taking this step for yourself.' : 'Your order has been received.',
        helpText: 'We’ll email you a link to your order, so you can return here anytime.',
        downloadsHeading: 'Your files and links'
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
    if (entry.copy.content?.trim()) {
      copy.content = entry.copy.content.trim()
    } else if (['heading', 'message', 'helpText'].some((key) => entry.copy[key as keyof typeof entry.copy]?.trim())) {
      copy.content = undefined
    }
    for (const key of Object.keys(copy) as Array<keyof ThankYouOverride>) {
      const value = entry.copy[key]?.trim()
      if (value) {
        copy[key] = value
      }
    }
  }
  copy.content = thankYouMarkdown(copy)
  return copy
}

// Older saved texts remain readable when opened in the combined editor.
export function thankYouMarkdown(copy: ThankYouCopy): string {
  if (copy.content?.trim()) {
    return copy.content.trim()
  }
  const escape = (value: string) => value.replace(/[\\`*_{}[\]()#+.!<>-]/g, '\\$&')
  return [`# ${escape(copy.heading)}`, escape(copy.message), escape(copy.helpText)].filter(Boolean).join('\n\n')
}
