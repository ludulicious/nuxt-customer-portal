import { createError } from 'h3'
import sharp from 'sharp'
import { portalBrandImageFields, type PortalSettings } from '../../shared/settings'

export async function validateBrandImages(settings: PortalSettings) {
  for (const name of portalBrandImageFields) {
    const value = settings.branding[name]
    if (!value) {
      continue
    }
    const encoded = value.split(',', 2)[1] || ''
    const buffer = Buffer.from(encoded, 'base64')
    if (buffer.length > 2_000_000) {
      throw createError({ statusCode: 400, message: `${name} must be smaller than 2 MB` })
    }
    try {
      const metadata = await sharp(buffer).metadata()
      if (!['png', 'jpeg', 'webp'].includes(metadata.format || '') || !metadata.width || !metadata.height) {
        throw new Error('Unsupported image')
      }
      if (metadata.width > 2400 || metadata.height > 2400) {
        throw createError({ statusCode: 400, message: `${name} dimensions must not exceed 2400×2400` })
      }
      if (name.startsWith('mark') && (metadata.width < 64 || metadata.height < 64)) {
        throw createError({ statusCode: 400, message: `${name} must be at least 64×64` })
      }
    } catch (error) {
      if (error && typeof error === 'object' && 'statusCode' in error) {
        throw error
      }
      throw createError({ statusCode: 400, message: `${name} is not a valid image` })
    }
  }
}
