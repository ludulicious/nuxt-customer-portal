import type { PortalFeatureDefinition } from '@nuxt-customer-portal/core/shared/types/feature'

const platformAdministrationFeature: PortalFeatureDefinition = {
  id: 'administration',
  navigation: [{ id: 'admin', labelKey: 'nav.admin', icon: 'i-lucide-shield-check', to: '/platform/tenants', audiences: ['admin'], order: 100 }],
  modules: [{
    id: 'admin', labelKey: 'nav.admin', icon: 'i-lucide-shield-check', to: '/platform/tenants', routePrefixes: ['/platform'], audiences: ['admin'], order: 100,
    menuItems: [
      { id: 'platform-tenants', labelKey: 'platform.menu.tenants', icon: 'i-lucide-building-2', to: '/platform/tenants', audiences: ['admin'] },
      { id: 'platform-onboarding', labelKey: 'platform.menu.onboarding', icon: 'i-lucide-plus-circle', to: '/platform/onboarding', audiences: ['admin'] }
    ]
  }],
  policy: { owner: [], admin: [], member: [] }
}

export default defineNuxtPlugin({
  name: 'platform-administration-feature',
  setup() {
    usePortalFeatures().registerFeature(platformAdministrationFeature)
  }
})
