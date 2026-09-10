import { registerClientConfigurationResolver } from '@nuxt-customer-portal/core/server/utils/client-configuration'
import { readPortalSettings } from '../utils/portal-settings'

export default defineNitroPlugin(() => {
  registerClientConfigurationResolver(async () => (await readPortalSettings()).settings.clients)
})
