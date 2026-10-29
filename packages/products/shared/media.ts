import { mediaVariantKeySchema } from './media-variants'
import { z } from 'zod'

export const mediaFormats = ['jpg', 'jpeg', 'png', 'webp', 'gif']
export const mediaMaximum = 10 * 1024 * 1024
export const mediaContentTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] as const
export const mediaDetailsSchema = z.object({
  title: z.string().trim().min(1).max(250),
  alt: z.string().trim().min(1).max(2000),
  categories: z
    .array(z.string().trim().min(1).max(100))
    .max(50)
    .transform((values) => [...new Set(values)]),
  credit: z.string().trim().max(500).default(''),
  visible: z.boolean().default(true)
})
export const mediaUploadSchema = z
  .object({
    files: z
      .array(
        z.object({
          role: z.enum(['original', 'image', 'thumbnail', 'variant']),
          key: mediaVariantKeySchema.optional(),
          name: z.string().trim().min(1).max(250),
          contentType: z.enum(mediaContentTypes),
          size: z.number().int().positive().max(mediaMaximum)
        })
      )
      .min(1)
      .max(15)
  })
  .superRefine((value, ctx) => {
    const keys = new Set<string>()
    value.files.forEach((file, index) => {
      const key =
        file.role === 'variant' ? `variant:${file.key}` : file.role === 'thumbnail' ? 'variant:thumbnail' : file.role
      if ((file.role === 'variant') !== !!file.key || keys.has(key)) {
        ctx.addIssue({ code: 'custom', path: ['files', index], message: 'Invalid or duplicate image variant' })
      }
      keys.add(key)
    })
  })
export const mediaSaveSchema = mediaDetailsSchema
  .extend({
    id: z.string().uuid().optional(),
    revision: z.number().int().positive().optional(),
    uploadId: z.string().uuid().optional(),
    presetRevision: z.number().int().positive().optional(),
    resetVariants: z.array(mediaVariantKeySchema).max(12).default([])
  })
  .refine((value) => !value.id || !!value.revision, { message: 'Revision is required' })
export const mediaListSchema = z.object({
  search: z.string().trim().max(250).default(''),
  category: z.string().max(100).default(''),
  visibility: z.enum(['all', 'visible', 'hidden']).default('all'),
  sortBy: z.enum(['order', 'title', 'created']).default('order'),
  sortDir: z.enum(['asc', 'desc']).default('asc'),
  page: z.coerce.number().int().min(1).max(100000).default(1)
})
export const mediaReorderSchema = z.object({
  id: z.string().uuid(),
  beforeId: z.string().uuid().nullable(),
  revision: z.number().int().positive()
})
export type MediaDetails = z.infer<typeof mediaDetailsSchema>
export type MediaListQuery = z.infer<typeof mediaListSchema>
export interface MediaFile {
  name: string
  contentType: string
  size: number
  width: number
  height: number
  url: string
}
export interface MediaVariant {
  key: string
  label: string
  mode: 'automatic' | 'custom'
  width: number
  height: number
  file: MediaFile
  source?: MediaFile
}
export interface StoreMedia extends MediaDetails {
  id: string
  revision: number
  order: number
  createdAt: string
  updatedAt: string
  image: MediaFile
  thumbnail?: MediaFile
  original?: MediaFile
  variants: Record<string, MediaVariant>
  variantsOutdated: boolean
}
export interface MediaPage {
  items: StoreMedia[]
  categories: string[]
  pagination: { total: number; page: number; pageSize: number; pageCount: number }
}
export interface MediaUpload {
  id: string
  files: { id: string; role: 'original' | 'image' | 'thumbnail' | 'variant'; key?: string; url: string }[]
}

export function mediaContentUrl(id: string, variant: string, version: string, source = false) {
  return `/api/products/media/${encodeURIComponent(id)}/content?variant=${encodeURIComponent(variant)}${source ? '&source=1' : ''}&v=${encodeURIComponent(version)}`
}
