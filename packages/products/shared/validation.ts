import { z } from 'zod'

export const localeSchema = z.enum(['en', 'nl']).default('en')
const text = (max: number) => z.string().trim().max(max)
const copy = z.object({ title: text(200), summary: text(1000), description: text(50000) })
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
    slug: text(120).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    type: z.enum(['digital', 'service']),
    category: text(100),
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
    prices: z.array(priceSchema).max(30)
  })
  .superRefine((v, ctx) => {
    if (!v.content.en.title && !v.content.nl.title) {
      ctx.addIssue({ code: 'custom', path: ['content.en.title'], message: 'A title is required' })
    }
    if (new Set(v.prices.map((p) => p.currency)).size !== v.prices.length) {
      ctx.addIssue({ code: 'custom', path: ['prices'], message: 'Only one price per currency' })
    }
    if (v.status === 'published' && !v.prices.length) {
      ctx.addIssue({ code: 'custom', path: ['prices'], message: 'A published product needs a price' })
    }
    if (v.status === 'published' && v.type === 'digital' && !v.fileIds.length) {
      ctx.addIssue({ code: 'custom', path: ['fileIds'], message: 'A digital product needs a file' })
    }
  })
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
  sortBy: z.enum(['title', 'updatedAt']).default('updatedAt'),
  sortDir: z.enum(['asc', 'desc']).default('desc'),
  locale: localeSchema,
  currency: z
    .string()
    .regex(/^[A-Z]{3}$/)
    .optional()
})
export const keySchema = z.object({ name: text(100).min(1), expiresAt: z.iso.datetime().nullable().default(null) })
export const settingsSchema = z.object({ enabled: z.boolean(), defaultLocale: z.enum(['en', 'nl']) })
export const emptyProduct = () => ({
  slug: '',
  type: 'digital' as const,
  category: '',
  status: 'draft' as const,
  content: { en: { title: '', summary: '', description: '' }, nl: { title: '', summary: '', description: '' } },
  taxCode: 'txcd_10000000',
  nextSteps: { en: '', nl: '' },
  imageIds: [] as string[],
  fileIds: [] as string[],
  videoUrl: '',
  prices: [{ currency: 'EUR', amount: 1000, taxBehavior: 'inclusive' as const }]
})

export const categorySchema = z.object({ name: z.string().trim().min(1).max(100) })
