import type { PortalFeatureDefinition } from '@nuxt-customer-portal/core/shared/types/feature'

export const saasConfigurationFeature: PortalFeatureDefinition = {
  id: 'saas-configuration',
  navigation: [{ id: 'portal-settings', labelKey: 'saasSettings.navigation', icon: 'i-lucide-palette', to: '/admin/portal-settings', audiences: ['admin'], location: 'admin', order: 120 }],
  moduleMenuItems: [{ moduleId: 'admin', item: { id: 'portal-settings', labelKey: 'saasSettings.navigation', icon: 'i-lucide-palette', to: '/admin/portal-settings', audiences: ['admin'], order: 120 } }],
  policy: { owner: [], admin: [], member: [] }
}
