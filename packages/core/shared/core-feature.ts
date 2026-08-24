import type { PortalFeatureDefinition } from './types/feature'

export const coreFeature: PortalFeatureDefinition = {
  id: 'portal-core',
  navigation: [
    {
      id: 'dashboard',
      labelKey: 'menu.dashboard',
      icon: 'i-lucide-layout-dashboard',
      to: '/dashboard',
      audiences: ['authenticated'],
      order: 10
    }
  ],
  modules: [
    {
      id: 'dashboard',
      labelKey: 'menu.dashboard',
      icon: 'i-lucide-layout-dashboard',
      to: '/dashboard',
      routePrefixes: ['/dashboard'],
      audiences: ['authenticated'],
      order: 10,
      menuItems: [
        {
          id: 'dashboard',
          labelKey: 'menu.dashboard',
          icon: 'i-lucide-layout-dashboard',
          to: '/dashboard',
          audiences: ['authenticated']
        }
      ]
    }
  ],
  policy: { owner: [], admin: [], member: [] }
}
