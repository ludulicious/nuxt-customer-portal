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
          role: z.enum(['original', 'image', 'thumbnail']),
          name: z.string().trim().min(1).max(250),
          contentType: z.enum(mediaContentTypes),
          size: z.number().int().positive().max(mediaMaximum)
        })
      )
      .min(1)
      .max(3)
  })
  .refine((value) => new Set(value.files.map((file) => file.role)).size === value.files.length, {
    message: 'Duplicate file role'
  })
export const mediaSaveSchema = mediaDetailsSchema
  .extend({
    id: z.string().uuid().optional(),
    revision: z.number().int().positive().optional(),
    uploadId: z.string().uuid().optional()
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
export interface StoreMedia extends MediaDetails {
  id: string
  revision: number
  order: number
  createdAt: string
  updatedAt: string
  image: MediaFile
  thumbnail?: MediaFile
  original?: MediaFile
}
export interface MediaPage {
  items: StoreMedia[]
  categories: string[]
  pagination: { total: number; page: number; pageSize: number; pageCount: number }
}
export interface MediaUpload {
  id: string
  files: { id: string; role: 'original' | 'image' | 'thumbnail'; url: string }[]
}
