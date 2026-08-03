import type { PortalFeatureDefinition } from '#portal/shared/types/feature'

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
      audiences: ['organizationAdmin', 'admin'],
      location: 'admin',
      order: 120
    }
  ],
  dashboardWidgets: [
    {
      id: 'recent-service-requests',
      component: 'RecentServiceRequestsWidget',
      order: 20
    }
  ],
  policy: {
    owner: serviceRequestActions,
    admin: serviceRequestActions,
    member: ['create', 'read', 'update', 'list']
  }
}
