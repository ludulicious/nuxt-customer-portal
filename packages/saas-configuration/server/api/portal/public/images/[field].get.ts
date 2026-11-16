import { portalImageResponse } from '@nuxt-customer-portal/core/server/utils/portal-image-response'
import { portalBrandImageFields, type PortalBrandImageField } from '../../../../../shared/settings'

// These are the same public assets exposed by /api/portal/public, including before login.
export default defineEventHandler(async (event) => {
  const field = getRouterParam(event, 'field') as PortalBrandImageField
  if (!portalBrandImageFields.includes(field)) {
    throw createError({ statusCode: 404, message: 'Image not found' })
  }
  const { settings } = await readPortalSettings()
  return portalImageResponse(event, settings.branding[field], 'logo', {
    public: true,
    size: field.startsWith('mark')
      ? 96
      : field === 'authBackgroundDesktop'
        ? 1600
        : field === 'authBackgroundMobile'
          ? 960
          : 512
  })
})
