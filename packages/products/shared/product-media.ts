import { z } from 'zod'
import { mediaVariantKeySchema } from './media-variants'

export const productMediaSchema = z.object({
  mediaId: z.string().uuid(),
  purpose: z.enum(['thumbnail', 'gallery', 'detail']),
  variant: z.union([z.literal('image'), mediaVariantKeySchema])
})
export type ProductMediaSelection = z.infer<typeof productMediaSchema>
