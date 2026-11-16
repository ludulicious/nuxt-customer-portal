import sharp from 'sharp'
import { portalImageUrl } from './portal-image'
import { PROFILE_IMAGE_INPUT_LIMIT, PROFILE_IMAGE_STORED_LIMIT, PROFILE_IMAGE_SIZE } from '../../shared/profile-image'

export class ProfileImageError extends Error {
  constructor(public code: 'PROFILE_IMAGE_INVALID' | 'PROFILE_IMAGE_TOO_LARGE') {
    super(code === 'PROFILE_IMAGE_TOO_LARGE' ? 'Profile images must be smaller than 5 MB' : 'Invalid profile image')
  }
}

const portalOrigin = () => process.env.BETTER_AUTH_URL || process.env.PUBLIC_URL || 'http://localhost:3051'

// Session responses are also consumed by connected websites, so image references
// must use the portal origin rather than the website's origin.
export const profileImageUrl = (userId: string, image: string | null | undefined, baseURL = portalOrigin()) => {
  const url = portalImageUrl('user', userId, 'avatar', image)
  return url?.startsWith('/api/portal/images/') ? new URL(url, baseURL).href : url
}

export const prepareProfileImage = async (
  image: string | null | undefined,
  userId?: string,
  baseURL = portalOrigin()
): Promise<string | null | undefined> => {
  if (image === undefined) {
    return undefined
  }
  if (!image) {
    return null
  }
  if (!image.startsWith('data:')) {
    let url: URL
    try {
      url = new URL(image, baseURL)
    } catch {
      throw new ProfileImageError('PROFILE_IMAGE_INVALID')
    }
    const isPortalImage = url.origin === new URL(baseURL).origin && url.pathname.startsWith('/api/portal/images/')
    if (isPortalImage) {
      if (
        userId &&
        url.pathname === `/api/portal/images/user/${encodeURIComponent(userId)}/avatar` &&
        /^[a-f0-9]{24}$/.test(url.searchParams.get('v') ?? '')
      ) {
        // An unchanged (possibly stale) display reference must not overwrite the
        // source image or undo a concurrent avatar update.
        return undefined
      }
      throw new ProfileImageError('PROFILE_IMAGE_INVALID')
    }
    if (!/^https?:$/.test(url.protocol) || image.length > 2048 || !/^https?:\/\//.test(image)) {
      throw new ProfileImageError('PROFILE_IMAGE_INVALID')
    }
    // Never fetch remote images on the server: social-provider URLs stay URLs.
    return image
  }
  if (image.length > Math.ceil(PROFILE_IMAGE_INPUT_LIMIT / 3) * 4 + 100) {
    throw new ProfileImageError('PROFILE_IMAGE_TOO_LARGE')
  }
  const match = /^data:image\/(?:png|jpe?g|webp|gif);base64,([a-z0-9+/=\s]+)$/i.exec(image)
  if (!match) {
    throw new ProfileImageError('PROFILE_IMAGE_INVALID')
  }
  const input = Buffer.from(match[1]!, 'base64')
  if (input.length > PROFILE_IMAGE_INPUT_LIMIT) {
    throw new ProfileImageError('PROFILE_IMAGE_TOO_LARGE')
  }
  try {
    const source = sharp(input, { limitInputPixels: 25_000_000 })
    const metadata = await source.metadata()
    if (!['jpeg', 'png', 'gif', 'webp'].includes(metadata.format ?? '')) {
      throw new Error('Unsupported image')
    }
    for (const size of [PROFILE_IMAGE_SIZE, 192, 128]) {
      for (const quality of [80, 60]) {
        const output = await source
          .clone()
          .rotate()
          .resize({ width: size, height: size, fit: 'inside', withoutEnlargement: true })
          .webp({ quality })
          .toBuffer()
        if (output.length <= PROFILE_IMAGE_STORED_LIMIT) {
          return `data:image/webp;base64,${output.toString('base64')}`
        }
      }
    }
  } catch {
    throw new ProfileImageError('PROFILE_IMAGE_INVALID')
  }
  throw new ProfileImageError('PROFILE_IMAGE_INVALID')
}
