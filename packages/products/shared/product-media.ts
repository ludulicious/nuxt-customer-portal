import { z } from 'zod'
import { mediaVariantKeySchema } from './media-variants'

export const productMediaSchema = z.object({
  mediaId: z.string().uuid(),
  purpose: z.enum(['thumbnail', 'gallery', 'detail']).default('gallery'),
  variant: z.union([z.literal('image'), mediaVariantKeySchema]).default('image')
})
export type ProductMediaSelection = z.input<typeof productMediaSchema>

export function orderedProductImageIds(
  ids: string[],
  assets: { id: string; media_id?: string | null }[],
  thumbnailId?: string | null
) {
  const seen = new Set<string>()
  return [...(thumbnailId && ids.includes(thumbnailId) ? [thumbnailId] : []), ...ids].filter((id) => {
    const key = assets.find((asset) => asset.id === id)?.media_id || id
    if (seen.has(key)) {
      return false
    }
    seen.add(key)
    return true
  })
}
export function orderedProductImagePlacements(ids: string[]) {
  const imageIds = [...new Set(ids)]
  return {
    imageSelection: 'ordered' as const,
    imageIds,
    thumbnailImageId: imageIds[0] || null,
    galleryImageIds: [...imageIds],
    detailImageIds: [...imageIds]
  }
}
