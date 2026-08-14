import type { PortalFeatureDefinition } from '@nuxt-customer-portal/core/shared/types/feature'

export const serviceRequestActions = ['create', 'read', 'update', 'delete', 'list', 'manage'] as const
export type ServiceRequestAction = typeof serviceRequestActions[number]

export const serviceRequestFeature: PortalFeatureDefinition<ServiceRequestAction> = {
  id: 'service-requests',
  navigation: [
    {
      id: 'service-requests',
      labelKey: 'features.serviceRequests.navigation.myRequests',
      icon: 'i-lucide-ticket',
      to: '/requests',
      audiences: ['authenticated'],
      order: 20
    },
    {
      id: 'service-requests-admin',
      labelKey: 'features.serviceRequests.navigation.manageRequests',
      icon: 'i-lucide-list-checks',
      to: '/admin/requests',
      audiences: ['providerAdmin'],
      location: 'admin',
      order: 120
    }
  ],
  modules: [{
    id: 'service-requests',
    labelKey: 'features.serviceRequests.navigation.myRequests',
    icon: 'i-lucide-ticket',
    to: '/requests',
    routePrefixes: ['/requests', '/admin/requests'],
    audiences: ['authenticated'],
    order: 20,
    menuItems: [
      { id: 'requests', labelKey: 'features.serviceRequests.navigation.myRequests', icon: 'i-lucide-inbox', to: '/requests', audiences: ['authenticated'] },
      { id: 'new-request', labelKey: 'features.serviceRequests.navigation.newRequest', icon: 'i-lucide-plus', to: '/requests/new', audiences: ['authenticated'] },
      { id: 'manage-requests', labelKey: 'features.serviceRequests.navigation.manageRequests', icon: 'i-lucide-list-checks', to: '/admin/requests', audiences: ['providerAdmin'] }
    ]
  }],
  dashboardWidgets: [
    {
      id: 'service-requests-attention',
      component: 'ServiceRequestsDashboardAttention',
      area: 'attention',
      size: 'half',
      order: 30
    },
    {
      id: 'service-requests-overview',
      component: 'ServiceRequestsDashboardOverview',
      area: 'aside',
      size: 'full',
      order: 10
    }
  ],
  clientIntegration: { moduleId: 'service-requests', labelKey: 'features.serviceRequests.navigation.myRequests' },
  policy: {
    PROVIDER: { owner: serviceRequestActions, admin: serviceRequestActions, member: ['create', 'read', 'update', 'list'] },
    CLIENT: { owner: ['create', 'read', 'update', 'list'], admin: ['create', 'read', 'update', 'list'], member: ['create', 'read', 'update', 'list'] }
  }
}
