import { z } from 'zod'
import type { Locale, Order, OrderLine } from './types'
import { hasPurchaseAccess } from './access'

export const purchasedLinkSchema = z.object({
  id: z.string().uuid(),
  url: z
    .string()
    .trim()
    .max(2000)
    .refine((value) => {
      try {
        const url = new URL(value)
        return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password
      } catch {
        return false
      }
    }, 'Invalid link URL'),
  labels: z.object({ en: z.string().trim().max(200), nl: z.string().trim().max(200) })
})
export const purchasedLinksSchema = z
  .array(purchasedLinkSchema)
  .max(100)
  .superRefine((links, ctx) => {
    if (new Set(links.map((link) => link.id)).size !== links.length) {
      ctx.addIssue({ code: 'custom', message: 'Duplicate link IDs' })
    }
  })
export type PurchasedLink = z.infer<typeof purchasedLinkSchema>
export interface PurchaseLink {
  id: string
  name: string
  url: string
}

export function localizedPurchaseLinks(links: PurchasedLink[] | undefined, locale: Locale): PurchaseLink[] {
  return (links || []).map((link) => ({
    id: link.id,
    name: link.labels[locale] || link.labels[locale === 'en' ? 'nl' : 'en'] || link.url,
    url: link.url
  }))
}
export function purchaseLinks(order: Order, line?: OrderLine): PurchaseLink[] {
  if (!hasPurchaseAccess(order)) {
    return []
  }
  return (line ? [line] : order.lines)
    .filter((item) => hasPurchaseAccess(order, item))
    .flatMap((item) => localizedPurchaseLinks(item.snapshot.product.links, order.snapshot.locale))
}
