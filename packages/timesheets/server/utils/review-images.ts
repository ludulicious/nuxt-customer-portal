import { portalImageVersion } from '@nuxt-customer-portal/core/server/utils/portal-image'
import { getOrganizationAvatar } from '@nuxt-customer-portal/core/shared/organization-avatar'

export const reviewImageUrl = (
  linkId: string,
  side: 'client' | 'supplier',
  branding: { logo: string | null; metadata: string | null }
) => {
  const value = getOrganizationAvatar(branding)
  return value?.startsWith('data:image/')
    ? `/api/timesheets/review-images/${encodeURIComponent(linkId)}/${side}?v=${portalImageVersion(value)}`
    : (value ?? null)
}
