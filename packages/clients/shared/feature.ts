import type { PortalFeatureDefinition } from '@nuxt-customer-portal/core/shared/types/feature'

export const clientActions = ['read', 'create', 'update', 'archive', 'delete', 'manageMembers', 'manageModules'] as const
export type ClientAction = typeof clientActions[number]

export const clientsFeature: PortalFeatureDefinition<ClientAction> = {
  id: 'clients',
  navigation: [{ id: 'clients', labelKey: 'features.clients.title', icon: 'i-lucide-building-2', to: '/clients', audiences: ['ownerAdmin'], order: 20 }],
  modules: [{
    id: 'clients', labelKey: 'features.clients.title', icon: 'i-lucide-building-2', to: '/clients', routePrefixes: ['/clients'], audiences: ['ownerAdmin'], order: 20,
    menuItems: [{ id: 'clients-list', labelKey: 'features.clients.title', icon: 'i-lucide-building-2', to: '/clients', audiences: ['ownerAdmin'] }]
  }],
  policy: {
    OWNER: { owner: clientActions, admin: clientActions.filter(action => action !== 'delete'), member: [] },
    CLIENT: { owner: ['read', 'update', 'manageMembers'], admin: ['read', 'update', 'manageMembers'], member: ['read'] }
  }
}
