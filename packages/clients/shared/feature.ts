import type { PortalFeatureDefinition } from '@nuxt-customer-portal/core/shared/types/feature'

export const clientActions = [
  'read',
  'create',
  'update',
  'archive',
  'delete',
  'manageMembers',
  'manageModules'
] as const
export type ClientAction = (typeof clientActions)[number]

export const clientsFeature: PortalFeatureDefinition<ClientAction> = {
  id: 'clients',
  navigation: [
    {
      id: 'clients',
      labelKey: 'features.clients.title',
      icon: 'i-lucide-building-2',
      to: '/clients',
      audiences: ['providerAdmin'],
      order: 20
    }
  ],
  modules: [
    {
      id: 'clients',
      labelKey: 'features.clients.title',
      icon: 'i-lucide-building-2',
      to: '/clients',
      routePrefixes: ['/clients'],
      audiences: ['providerAdmin'],
      order: 20,
      menuItems: [
        {
          id: 'clients-list',
          labelKey: 'features.clients.title',
          icon: 'i-lucide-building-2',
          to: '/clients',
          audiences: ['providerAdmin']
        }
      ]
    }
  ],
  policy: {
    PROVIDER: { owner: clientActions, admin: clientActions.filter((action) => action !== 'delete'), member: [] },
    CLIENT: { owner: ['read', 'update', 'manageMembers'], admin: ['read', 'update', 'manageMembers'], member: ['read'] }
  }
}

export const clientsIcon = (allowedTypes: readonly string[] = []) =>
  allowedTypes.includes('person') ? 'i-lucide-users-round' : 'i-lucide-building-2'

export const createClientsFeature = (allowedTypes: readonly string[]): typeof clientsFeature => {
  const icon = clientsIcon(allowedTypes)
  return {
    ...clientsFeature,
    navigation: clientsFeature.navigation?.map((item) => ({ ...item, icon })),
    modules: clientsFeature.modules?.map((item) => ({
      ...item,
      icon,
      menuItems: item.menuItems?.map((entry) => ({ ...entry, icon }))
    }))
  }
}
