import { z } from 'zod'
import { markdownStyleSchema } from './markdown-style'
import { portalLanguageCodes } from '@nuxt-customer-portal/core/shared/languages'
import { checkoutAppearanceSchema, defaultCheckoutAppearance } from './checkout-appearance'

export const localeSchema = z.enum(portalLanguageCodes).default('en')
const text = (max: number) => z.string().trim().max(max)
const copy = z.object({
  title: text(200),
  subtitle: text(200).default(''),
  buyButtonLabel: text(80).default(''),
  secondaryCta: text(200).default(''),
  summary: text(1000),
  description: text(50000)
})
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
    thumbnailImageId: text(100).min(1).nullable().default(null),
    galleryImageIds: z.array(text(100).min(1)).max(20).default([]),
    detailImageIds: z.array(text(100).min(1)).max(20).default([]),
    fileIds: z.array(text(100).min(1)).max(100),
    fileNames: z.record(z.string(), z.object({ en: text(200), nl: text(200) })).default({}),
    videoUrl: z
      .string()
      .max(2000)
      .refine((v) => !v || (/^https:\/\//.test(v) && z.url().safeParse(v).success)),
    prices: z.array(priceSchema.extend({ amount: z.number().int().nonnegative().max(100000000) })).max(30)
  })
  .superRefine((v, ctx) => {
    const imageIds = new Set(v.imageIds)
    for (const [field, ids] of [
      ['galleryImageIds', v.galleryImageIds],
      ['detailImageIds', v.detailImageIds]
    ] as const) {
      if (new Set(ids).size !== ids.length || ids.some((id) => !imageIds.has(id))) {
        ctx.addIssue({ code: 'custom', path: [field], message: 'Select images from this product library' })
      }
    }
    if (v.thumbnailImageId && !imageIds.has(v.thumbnailImageId)) {
      ctx.addIssue({ code: 'custom', path: ['thumbnailImageId'], message: 'Select an image from this product library' })
    }
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
    if (v.status === 'published' && !v.thumbnailImageId) {
      ctx.addIssue({ code: 'custom', path: ['thumbnailImageId'], message: 'Choose a thumbnail image' })
    }
    if (v.status === 'published' && !v.galleryImageIds.length) {
      ctx.addIssue({ code: 'custom', path: ['galleryImageIds'], message: 'Choose at least one gallery image' })
    }
    if (v.status === 'published' && !v.detailImageIds.length) {
      ctx.addIssue({ code: 'custom', path: ['detailImageIds'], message: 'Choose at least one product details image' })
    }
  })
export const productCreateSchema = productSchema.safeExtend({ categoryId: text(100).min(1) })

export const billingSchema = z
  .object({
    type: z.enum(['person', 'organization']),
    firstName: text(100),
    lastName: text(100),
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
    if (v.type === 'person' && !v.firstName) {
      c.addIssue({ code: 'custom', path: ['firstName'], message: 'First name is required' })
    }
    if (v.type === 'person' && !v.lastName) {
      c.addIssue({ code: 'custom', path: ['lastName'], message: 'Last name is required' })
    }
    if (v.type === 'organization' && !v.company) {
      c.addIssue({ code: 'custom', path: ['company'], message: 'Company name is required' })
    }
  })
export const checkoutSchema = z.object({
  productId: text(100).min(1),
  priceId: text(100).min(1),
  locale: localeSchema,
  returnUrl: z.string().trim().max(2000).optional(),
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
export const settingsSchema = z
  .object({
    checkoutAppearance: checkoutAppearanceSchema.default(defaultCheckoutAppearance()),
    markdownStyle: markdownStyleSchema.optional(),
    currencyTaxBehavior: z.partialRecord(z.enum(productCurrencies), z.enum(['inclusive', 'exclusive'])).default({}),
    enabled: z.boolean(),
    mode: z.enum(['sandbox', 'live']).default('sandbox'),
    defaultLocale: z.enum(portalLanguageCodes),
    languages: z
      .array(z.enum(portalLanguageCodes))
      .min(1)
      .refine((values) => new Set(values).size === values.length)
      .default([...portalLanguageCodes]),
    currencies: z
      .array(z.enum(productCurrencies))
      .min(1)
      .refine((v) => new Set(v).size === v.length),
    imagePolicy: z
      .object({
        thumbnail: imageSizeSchema({ width: 400, height: 400 }),
        gallery: imageSizeSchema({ width: 800, height: 1000 }),
        detail: imageSizeSchema({ width: 1200, height: 900 })
      })
      .default({
        thumbnail: { width: 400, height: 400 },
        gallery: { width: 800, height: 1000 },
        detail: { width: 1200, height: 900 }
      })
  })
  .refine((settings) => settings.languages.includes(settings.defaultLocale), {
    path: ['defaultLocale'],
    message: 'Choose a supported store language'
  })
function imageSizeSchema(defaultValue: { width: number; height: number }) {
  return z
    .object({
      width: z.coerce.number().int().min(200).max(2400),
      height: z.coerce.number().int().min(200).max(2400)
    })
    .default(defaultValue)
}
export const storageSettingsSchema = z
  .object({
    provider: z.enum(['s3', 'bunny']).default('s3'),
    endpoint: z
      .string()
      .trim()
      .max(500)
      .refine((value) => !value || /^https?:\/\//.test(value), 'Use a valid HTTP(S) endpoint'),
    region: z.string().trim().max(100),
    bucket: z.string().trim().min(3).max(255),
    accessKeyId: z.string().trim().max(256).optional(),
    secretAccessKey: z.string().min(8).max(500).optional(),
    pathStyle: z.boolean().default(false)
  })
  .superRefine((value, context) => {
    if (value.provider === 's3' && !value.region) {
      context.addIssue({ code: 'custom', path: ['region'], message: 'S3 region is required' })
    }
  })
export const cropSchema = z
  .object({
    x: z.number().min(0).max(1),
    y: z.number().min(0).max(1),
    width: z.number().positive().max(1),
    height: z.number().positive().max(1)
  })
  .refine((v) => v.x + v.width <= 1.000001 && v.y + v.height <= 1.000001, 'Crop exceeds image bounds')
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
  content: {
    en: { title: '', subtitle: '', buyButtonLabel: '', secondaryCta: '', summary: '', description: '' },
    nl: { title: '', subtitle: '', buyButtonLabel: '', secondaryCta: '', summary: '', description: '' }
  },
  taxCode: 'txcd_10000000',
  nextSteps: { en: '', nl: '' },
  imageIds: [] as string[],
  thumbnailImageId: null as string | null,
  galleryImageIds: [] as string[],
  detailImageIds: [] as string[],
  fileIds: [] as string[],
  fileNames: {} as Record<string, Record<'en' | 'nl', string>>,
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
