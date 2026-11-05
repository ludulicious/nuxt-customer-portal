import { registerWebsiteOriginsResolver } from '@nuxt-customer-portal/core/server/utils/website-origins'
import { readPortalSettings } from '../utils/portal-settings'

export default defineNitroPlugin(() => {
  registerWebsiteOriginsResolver(async () => (await readPortalSettings()).settings.websiteOrigins)
})
