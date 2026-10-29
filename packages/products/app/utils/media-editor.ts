import type { MediaRequest } from './media-request'
import type { MediaVariant, StoreMedia } from '../../shared/media'

export interface MediaEditorDocument {
  data: {
    title: string
    categories: string[]
    credit: string
    visible: boolean
    image: { src: string; alt: string; originalSrc?: string; name?: string }
    thumbnail?: { src: string }
    variants?: Record<string, MediaVariant>
    variantsOutdated?: boolean
  }
}
export function mediaEditorDocument(media: StoreMedia): MediaEditorDocument {
  return {
    data: {
      title: media.title,
      categories: media.categories,
      credit: media.credit,
      visible: media.visible,
      image: { src: media.image.url, alt: media.alt, originalSrc: media.original?.url, name: media.image.name },
      thumbnail: media.thumbnail ? { src: media.thumbnail.url } : undefined,
      variants: media.variants,
      variantsOutdated: media.variantsOutdated
    }
  }
}
export async function readMediaPreview(path: string): Promise<string> {
  const request = $fetch as MediaRequest
  const blob = await request<Blob>(path, { responseType: 'blob' })
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('The image could not be read.'))
    reader.readAsDataURL(blob)
  })
}
export const mediaError = (error: unknown) => {
  const cause = error as { data?: { message?: string }; message?: string }
  return cause.data?.message || cause.message || 'The image could not be saved.'
}
