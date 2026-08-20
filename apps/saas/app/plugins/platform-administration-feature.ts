import type { PortalFeatureDefinition } from '@nuxt-customer-portal/core/shared/types/feature'

const platformAdministrationFeature: PortalFeatureDefinition = {
  id: 'platform-administration',
  navigation: [{ id: 'platform-workspaces', labelKey: 'platform.menu.workspaces', icon: 'i-lucide-building-2', to: '/platform/workspaces', audiences: ['authenticated'], order: 100 }],
  modules: [{
    id: 'workspaces', labelKey: 'platform.menu.workspaces', icon: 'i-lucide-building-2', to: '/platform/workspaces', routePrefixes: ['/platform'], audiences: ['authenticated'], order: 100,
    menuItems: [
      { id: 'platform-workspaces', labelKey: 'platform.menu.workspaces', icon: 'i-lucide-building-2', to: '/platform/workspaces', audiences: ['authenticated'] },
      { id: 'platform-onboarding', labelKey: 'platform.menu.onboarding', icon: 'i-lucide-plus-circle', to: '/platform/onboarding', audiences: ['authenticated'] }
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
