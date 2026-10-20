import { z } from 'zod'
import type { CatalogPrice, Product, ProductOffer } from './types'
import { priceSchema } from './validation'

export const offerSchema = z
  .object({
    startsAt: z.iso.datetime({ offset: true }),
    endsAt: z.iso.datetime({ offset: true }),
    isFree: z.boolean(),
    prices: z.array(priceSchema.extend({ amount: z.number().int().nonnegative().max(100000000) })).max(30)
  })
  .superRefine((value, ctx) => {
    if (Date.parse(value.startsAt) >= Date.parse(value.endsAt)) {
      ctx.addIssue({ code: 'custom', path: ['endsAt'], message: 'End must be after start' })
    }
    if (new Set(value.prices.map((p) => p.currency)).size !== value.prices.length) {
      ctx.addIssue({ code: 'custom', path: ['prices'], message: 'Only one price per currency' })
    }
  })
export type OfferInput = z.infer<typeof offerSchema>
export const periodsOverlap = (
  a: Pick<ProductOffer, 'startsAt' | 'endsAt'>,
  b: Pick<ProductOffer, 'startsAt' | 'endsAt'>
) => Date.parse(a.startsAt) < Date.parse(b.endsAt) && Date.parse(b.startsAt) < Date.parse(a.endsAt)

export function offerPricesValid(
  offer: { isFree: boolean; prices: { currency: string; amount: number }[] },
  regular: { isFree?: boolean; prices: { currency: string; amount: number }[] },
  currencies: string[]
) {
  if (regular.isFree || !currencies.length) {
    return false
  }
  return (
    offer.prices.length === currencies.length &&
    new Set(offer.prices.map((p) => p.currency)).size === currencies.length &&
    currencies.every((currency) => {
      const base = regular.prices.find((p) => p.currency === currency)
      const price = offer.prices.find((p) => p.currency === currency)
      return (
        base &&
        price &&
        Number.isInteger(price.amount) &&
        price.amount >= 0 &&
        price.amount < base.amount &&
        (!offer.isFree || price.amount === 0)
      )
    })
  )
}

export function effectivePricing(
  product: Product,
  at: Date = new Date()
): Omit<Product, 'prices'> & { prices: CatalogPrice[] } {
  const time = at.getTime()
  const offer = product.offers?.find((o) => o.enabled && Date.parse(o.startsAt) <= time && time < Date.parse(o.endsAt))
  const prices = (offer?.prices || product.prices).map((price) => ({
    ...price,
    originalAmount: product.isFree
      ? 0
      : (product.prices.find((p) => p.currency === price.currency)?.amount ?? price.amount),
    offer: offer ? { id: offer.id, startsAt: offer.startsAt, endsAt: offer.endsAt } : null
  }))
  return {
    ...product,
    prices,
    isFree: offer ? prices.length > 0 && prices.every((p) => p.amount === 0) : !!product.isFree
  }
}

/** Resolve browser-local input, rejecting DST gaps and repeated clock times. */
export function localOfferTimestamp(value: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) {
    return null
  }
  const parts = value.split(/[-T:]/).map(Number)
  const [year, month, day, hour, minute] = parts as [number, number, number, number, number]
  const date = new Date(year, month - 1, day, hour, minute)
  const matches = (d: Date) =>
    d.getFullYear() === year &&
    d.getMonth() === month - 1 &&
    d.getDate() === day &&
    d.getHours() === hour &&
    d.getMinutes() === minute
  if (!matches(date)) {
    return null
  }
  // Include non-hour transitions (e.g. Lord Howe) and historic offset changes.
  for (let delta = -180; delta <= 180; delta++) {
    if (delta && matches(new Date(date.getTime() + delta * 60000))) {
      return null
    }
  }
  return date.toISOString()
}
