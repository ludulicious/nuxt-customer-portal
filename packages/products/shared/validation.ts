import { z } from 'zod'
import { markdownStyleSchema } from './markdown-style'
import { portalLanguageCodes } from '@nuxt-customer-portal/core/shared/languages'

export const localeSchema = z.enum(portalLanguageCodes).default('en')
const text = (max: number) => z.string().trim().max(max)
const copy = z.object({ title: text(200), subtitle: text(200).default(''), summary: text(1000), description: text(50000) })
export const productCurrencies = [
  'EUR',
  'USD',
  'GBP',
  'CAD',
  'AUD',
  'NZD',
  'CHF',
  'DKK',
  'NOK',
  'SEK',
  'PLN',
  'CZK',
  'HUF',
  'RON',
  'JPY',
  'HKD',
  'SGD',
  'AED'
] as const
export const priceSchema = z.object({
  currency: z.string().refine((value) => (productCurrencies as readonly string[]).includes(value)),
  amount: z.number().int().positive().max(100000000),
  taxBehavior: z.enum(['inclusive', 'exclusive'])
})
export const productSchema = z
  .object({
    isFree: z.boolean().default(false),
    slug: text(120).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    type: z.enum(['digital', 'service']),
    categoryId: text(100).min(1).nullable().default(null),
    status: z.enum(['draft', 'published', 'archived']),
    content: z.object({ en: copy, nl: copy }),
    taxCode: z.string().regex(/^txcd_\d{8}$/),
    nextSteps: z.object({ en: text(5000), nl: text(5000) }),
    imageIds: z.array(text(100).min(1)).max(20),
    fileIds: z.array(text(100).min(1)).max(100),
    videoUrl: z
      .string()
      .max(2000)
      .refine((v) => !v || (/^https:\/\//.test(v) && z.url().safeParse(v).success)),
    prices: z.array(priceSchema.extend({ amount: z.number().int().nonnegative().max(100000000) })).max(30)
  })
  .superRefine((v, ctx) => {
    if (!v.content.en.title && !v.content.nl.title) {
      ctx.addIssue({ code: 'custom', path: ['content.en.title'], message: 'A title is required' })
    }
    if (new Set(v.prices.map((p) => p.currency)).size !== v.prices.length) {
      ctx.addIssue({ code: 'custom', path: ['prices'], message: 'Only one price per currency' })
    }
    if (v.status === 'published' && !v.isFree) {
      v.prices.forEach((price, index) => {
        if (price.amount <= 0) {
          ctx.addIssue({
            code: 'custom',
            path: ['prices', index, 'amount'],
            message: 'Paid products need a positive price'
          })
        }
      })
    }
    if (v.status === 'published' && !v.isFree && !v.prices.length) {
      ctx.addIssue({ code: 'custom', path: ['prices'], message: 'A paid product needs a price' })
    }
    if (v.status === 'published' && v.type === 'digital' && !v.fileIds.length) {
      ctx.addIssue({ code: 'custom', path: ['fileIds'], message: 'A digital product needs a file' })
    }
  })
export const productCreateSchema = productSchema.safeExtend({ categoryId: text(100).min(1) })

export const billingSchema = z
  .object({
    type: z.enum(['person', 'organization']),
    name: text(200).min(1),
    email: z.email().transform((v) => v.toLowerCase()),
    company: text(200),
    address: text(2000).min(5),
    country: z.string().regex(/^[A-Z]{2}$/),
    registrationNumber: text(100),
    vatNumber: text(100),
    clientId: text(100).optional()
  })
  .superRefine((v, c) => {
    if (v.type === 'organization' && !v.company) {
      c.addIssue({ code: 'custom', path: ['company'], message: 'Company name is required' })
    }
  })
export const checkoutSchema = z.object({
  productId: text(100).min(1),
  priceId: text(100).min(1),
  locale: localeSchema,
  billing: billingSchema,
  requestId: z.uuid()
})
export const listSchema = z.object({
  page: z.coerce.number().int().min(1).max(100000).default(1),
  search: text(200).default(''),
  status: z.enum(['draft', 'published', 'archived']).optional(),
  type: z.enum(['digital', 'service']).optional(),
  category: text(100).optional(),
  categoryId: text(100).min(1).optional(),
  sortBy: z.enum(['title', 'updatedAt']).default('updatedAt'),
  sortDir: z.enum(['asc', 'desc']).default('desc'),
  locale: localeSchema,
  currency: z
    .string()
    .regex(/^[A-Z]{3}$/)
    .optional()
})
export const keySchema = z.object({ name: text(100).min(1), expiresAt: z.iso.datetime().nullable().default(null) })
export const settingsSchema = z
  .object({
    markdownStyle: markdownStyleSchema.optional(),
    currencyTaxBehavior: z.partialRecord(z.enum(productCurrencies), z.enum(['inclusive', 'exclusive'])).default({}),
    enabled: z.boolean(),
    defaultLocale: z.enum(portalLanguageCodes),
    languages: z
      .array(z.enum(portalLanguageCodes))
      .min(1)
      .refine((values) => new Set(values).size === values.length)
      .default([...portalLanguageCodes]),
    currencies: z
      .array(z.enum(productCurrencies))
      .min(1)
      .refine((v) => new Set(v).size === v.length)
  })
  .refine((settings) => settings.languages.includes(settings.defaultLocale), {
    path: ['defaultLocale'],
    message: 'Choose a supported store language'
  })
export const hasRequiredPrices = (
  product: { isFree?: boolean; prices: { currency: string; amount: number }[] },
  currencies: readonly string[]
) =>
  product.isFree ||
  currencies.every((currency) => product.prices.some((price) => price.currency === currency && price.amount > 0))

export const emptyProduct = () => ({
  isFree: false,
  slug: '',
  type: 'digital' as const,
  categoryId: null as string | null,
  status: 'draft' as const,
  content: { en: { title: '', subtitle: '', summary: '', description: '' }, nl: { title: '', subtitle: '', summary: '', description: '' } },
  taxCode: 'txcd_10000000',
  nextSteps: { en: '', nl: '' },
  imageIds: [] as string[],
  fileIds: [] as string[],
  videoUrl: '',
  prices: [{ currency: 'EUR', amount: 1000, taxBehavior: 'inclusive' as const }]
})

const categoryCopy = z.object({ name: text(100), description: text(5000) })
export const categorySchema = z.object({
  code: text(80)
    .min(1)
    .regex(/^[a-zA-Z0-9][a-zA-Z0-9_-]*$/)
    .transform((value) => value.toLowerCase()),
  content: z.object({ en: categoryCopy, nl: categoryCopy })
})
export const categoryDeleteSchema = z.object({ name: text(100).min(1) })
export const categoryListSchema = z.object({
  page: z.coerce.number().int().min(1).max(100000).default(1),
  search: text(200).default(''),
  sortBy: z.enum(['name', 'code']).default('name'),
  sortDir: z.enum(['asc', 'desc']).default('asc'),
  locale: localeSchema
})
