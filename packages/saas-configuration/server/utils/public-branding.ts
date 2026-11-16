import { portalImageVersion } from '@nuxt-customer-portal/core/server/utils/portal-image'
import { portalBrandImageFields, type PortalBranding } from '../../shared/settings'

export const publicBranding = (
  branding: PortalBranding,
  origin = process.env.PUBLIC_URL || process.env.BETTER_AUTH_URL || 'http://localhost:3051'
): PortalBranding => ({
  ...branding,
  ...Object.fromEntries(
    portalBrandImageFields.map((field) => {
      const value = branding[field]
      return [
        field,
        value.startsWith('data:image/')
          ? new URL(`/api/portal/public/images/${field}?v=${portalImageVersion(value)}`, origin).href
          : value
      ]
    })
  )
})
