import type { MediaRequest } from '../utils/media-request'
import type { MediaDetails, MediaPage, MediaUpload, StoreMedia } from '../../shared/media'
import type { ImageSubmission } from '../components/ProductsMediaImageEditor.vue'

export const useStoreMedia = () => {
  const request = useRequestFetch() as MediaRequest
  // Retain completed transfers after a completion/network failure so retry is safe.
  let pending: { signature: string; upload: MediaUpload; sent: Set<string> } | undefined
  const save = async (value: ImageSubmission, media?: StoreMedia) => {
    const files: { role: 'original' | 'image' | 'thumbnail'; blob: Blob; name: string }[] = []
    if (value.originalImage) {
      files.push({ role: 'original', blob: value.originalImage.blob, name: value.originalImage.filename })
    }
    if (!media && !value.originalImage) {
      files.push({ role: 'original', blob: value.blob, name: value.filename })
    }
    if (value.imageChanged && (!value.originalImage || value.blob !== value.originalImage.blob)) {
      files.push({ role: 'image', blob: value.blob, name: value.filename })
    }
    if (value.thumbnail) {
      files.push({ role: 'thumbnail', blob: value.thumbnail.blob, name: value.thumbnail.filename })
    }
    const details: MediaDetails = {
      title: value.title,
      alt: value.alt,
      categories: value.categories,
      credit: value.credit,
      visible: value.visible
    }
    const body = { ...details, id: media?.id, revision: media?.revision }
    if (!files.length) {
      return request<StoreMedia>('/api/products/media', { method: 'PUT', body })
    }
    // A content fingerprint also detects edits made after an unsuccessful save.
    const hashes = await Promise.all(
      files.map(async (file) =>
        Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', await file.blob.arrayBuffer())))
          .map((byte) => byte.toString(16).padStart(2, '0'))
          .join('')
      )
    )
    const signature = JSON.stringify({
      body,
      files: files.map((file, index) => [file.role, file.name, file.blob.type, hashes[index]])
    })
    if (pending?.signature !== signature) {
      const upload = await request<MediaUpload>('/api/products/media/uploads', {
        method: 'POST',
        body: {
          files: files.map((file) => ({
            role: file.role,
            name: file.name,
            contentType: file.blob.type,
            size: file.blob.size
          }))
        }
      })
      pending = { signature, upload, sent: new Set() }
    }
    for (const file of pending.upload.files) {
      if (pending.sent.has(file.id)) {
        continue
      }
      await request(file.url, { method: 'PUT', body: files.find((item) => item.role === file.role)!.blob })
      pending.sent.add(file.id)
    }
    const saved = await request<StoreMedia>(`/api/products/media/uploads/${pending.upload.id}/complete`, {
      method: 'POST',
      body
    })
    pending = undefined
    return saved
  }
  return {
    list: (query: Record<string, unknown>, signal?: AbortSignal) =>
      request<MediaPage>('/api/products/media', { query, signal }),
    get: (id: string) => request<StoreMedia>(`/api/products/media/${encodeURIComponent(id)}`),
    save,
    remove: (media: StoreMedia) =>
      request(`/api/products/media/${media.id}`, { method: 'DELETE', body: { revision: media.revision } }),
    reorder: (media: StoreMedia, beforeId: string | null) =>
      request('/api/products/media/reorder', {
        method: 'PUT',
        body: { id: media.id, beforeId, revision: media.revision }
      }),
    preview: (url: string, signal?: AbortSignal) => request<Blob>(url, { responseType: 'blob', signal })
  }
}
