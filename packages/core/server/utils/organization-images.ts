import { portalImageUrl } from './portal-image'

// Only display responses use these references. Editing endpoints keep originals.
export const organizationImageUrls = <T extends { id: string; logo?: string | null; metadata?: string | null }>(
  organization: T,
  origin = process.env.BETTER_AUTH_URL || process.env.PUBLIC_URL || 'http://localhost:3051'
): T => {
  const reference = (field: 'logo' | 'avatar', value: string | null | undefined) => {
    const url = portalImageUrl('organization', organization.id, field, value)
    return url?.startsWith('/api/portal/images/') ? new URL(url, origin).href : url
  }
  let metadata = organization.metadata
  try {
    const parsed = JSON.parse(metadata || '{}')
    if (typeof parsed?.avatarLogo === 'string' && parsed.avatarLogo.startsWith('data:image/')) {
      metadata = JSON.stringify({ ...parsed, avatarLogo: reference('avatar', parsed.avatarLogo) })
    }
  } catch {
    // Preserve legacy metadata, including invalid JSON.
  }
  return { ...organization, logo: reference('logo', organization.logo), metadata }
}

export const organizationListImageResponse = async (response: Response) => {
  if (!response.ok) {
    return response
  }
  const organizations = (await response.json()) as Array<{ id: string; logo?: string | null; metadata?: string | null }>
  const headers = new Headers(response.headers)
  headers.delete('content-length')
  headers.delete('content-encoding')
  headers.delete('etag')
  headers.set('content-type', 'application/json')
  return new Response(JSON.stringify(organizations.map((item) => organizationImageUrls(item))), {
    status: response.status,
    statusText: response.statusText,
    headers
  })
}
