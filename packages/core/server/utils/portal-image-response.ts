import { createError, getQuery, getHeader, setHeader, setResponseStatus, type H3Event } from 'h3'
import { portalImageThumbnail, portalImageVersion, type PortalImageField, type PortalImageSize } from './portal-image'

// Authorization must happen before calling this, including conditional requests.
export const portalImageResponse = async (
  event: H3Event,
  value: string | null,
  field: PortalImageField,
  options: { public?: boolean; size?: PortalImageSize } = {}
) => {
  if (!value?.startsWith('data:image/')) {
    throw createError({ statusCode: 404, message: 'Image not found' })
  }
  const version = portalImageVersion(value)
  if (getQuery(event).v !== version) {
    setHeader(event, 'Cache-Control', 'private, no-store')
    throw createError({ statusCode: 404, message: 'Image version not found' })
  }
  const size = options.size ?? (field === 'logo' ? 512 : 96)
  const etag = `"${version}-${size}"`
  setHeader(event, 'Cache-Control', `${options.public ? 'public' : 'private'}, max-age=86400, immutable`)
  if (!options.public) {
    setHeader(event, 'Vary', 'Cookie')
  }
  setHeader(event, 'ETag', etag)
  setHeader(event, 'X-Content-Type-Options', 'nosniff')
  if (getHeader(event, 'if-none-match') === etag) {
    setResponseStatus(event, 304)
    return ''
  }
  try {
    const bytes = await portalImageThumbnail(value, size)
    setHeader(event, 'Content-Type', 'image/webp')
    return bytes
  } catch {
    setHeader(event, 'Cache-Control', 'private, no-store')
    throw createError({ statusCode: 404, message: 'Image unavailable' })
  }
}
