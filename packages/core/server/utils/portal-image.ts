import { createHash } from 'node:crypto'
import sharp from 'sharp'

export type PortalImageKind = 'user' | 'organization'
export type PortalImageField = 'avatar' | 'logo'

export const portalImageVersion = (value: string) => createHash('sha256').update(value).digest('hex').slice(0, 24)

// Keep external URLs and document snapshots intact. Only embedded UI images need
// a separate request; the version changes whenever the stored image changes.
export const portalImageUrl = (
  kind: PortalImageKind,
  id: string,
  field: PortalImageField,
  value: string | null | undefined
) =>
  value?.startsWith('data:image/')
    ? `/api/portal/images/${kind}/${encodeURIComponent(id)}/${field}?v=${portalImageVersion(value)}`
    : (value ?? null)

const thumbnails = new Map<string, Buffer>()
const pending = new Map<string, Promise<Buffer>>()
let cacheBytes = 0
const maxCacheBytes = 16 * 1024 * 1024

export const portalImageThumbnail = async (value: string, size: 96 | 512) => {
  const key = `${portalImageVersion(value)}:${size}`
  const cached = thumbnails.get(key)
  if (cached) {
    thumbnails.delete(key)
    thumbnails.set(key, cached)
    return cached
  }
  const inFlight = pending.get(key)
  if (inFlight) {
    return inFlight
  }
  const render = async () => {
    const match = /^data:image\/(?:png|jpe?g|webp|gif|avif|svg\+xml);base64,([a-z0-9+/=\s]+)$/i.exec(value)
    if (!match || value.length > 14 * 1024 * 1024) {
      throw new Error('Unsupported embedded image')
    }
    const bytes = await sharp(Buffer.from(match[1]!, 'base64'), { limitInputPixels: 16_000_000 })
      .rotate()
      .resize({ width: size, height: size, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 80 })
      .toBuffer()
    while (thumbnails.size && (cacheBytes + bytes.length > maxCacheBytes || thumbnails.size >= 128)) {
      const oldest = thumbnails.keys().next().value!
      cacheBytes -= thumbnails.get(oldest)!.length
      thumbnails.delete(oldest)
    }
    if (bytes.length <= maxCacheBytes) {
      thumbnails.set(key, bytes)
      cacheBytes += bytes.length
    }
    return bytes
  }
  const promise = render().finally(() => pending.delete(key))
  pending.set(key, promise)
  return promise
}
