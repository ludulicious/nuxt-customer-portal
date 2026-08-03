import type { PortalFeatureDefinition } from '#portal/shared/types/feature'

export const accountOrganizationsFeature: PortalFeatureDefinition = {
  id: 'account-organizations',
  navigation: [
    { id: 'my-organizations', labelKey: 'myOrganizations.title', icon: 'i-lucide-building', to: '/my-organizations', audiences: ['authenticated'], order: 80 },
    { id: 'settings', labelKey: 'menu.settings.title', icon: 'i-lucide-settings', to: '/settings', audiences: ['authenticated'], order: 90 }
  ],
  policy: { owner: [], admin: [], member: [] }
}
