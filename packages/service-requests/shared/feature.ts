import type { PortalFeatureDefinition } from '@nuxt-customer-portal/core/shared/types/feature'

export const serviceRequestActions = ['create', 'read', 'update', 'delete', 'list', 'manage'] as const
export type ServiceRequestAction = (typeof serviceRequestActions)[number]

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
  modules: [
    {
      id: 'service-requests',
      labelKey: 'features.serviceRequests.navigation.myRequests',
      icon: 'i-lucide-ticket',
      to: '/requests',
      routePrefixes: ['/requests', '/admin/requests'],
      audiences: ['authenticated'],
      order: 20,
      menuItems: [
        {
          id: 'requests',
          labelKey: 'features.serviceRequests.navigation.myRequests',
          icon: 'i-lucide-inbox',
          to: '/requests',
          audiences: ['authenticated']
        },
        {
          id: 'new-request',
          labelKey: 'features.serviceRequests.navigation.newRequest',
          icon: 'i-lucide-plus',
          to: '/requests/new',
          audiences: ['authenticated']
        },
        {
          id: 'manage-requests',
          labelKey: 'features.serviceRequests.navigation.manageRequests',
          icon: 'i-lucide-list-checks',
          to: '/admin/requests',
          audiences: ['providerAdmin']
        }
      ]
    }
  ],
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
  emails: [{
    id: 'quote', labelKey: 'features.serviceRequests.sections.quotes',
    defaults: {
      en: { subject: 'Quote {{quote_number}} for {{request_title}}', body: 'A new quote is ready for {{request_title}}. It is valid until {{valid_until}}. Sign in to review it.' },
      nl: { subject: 'Offerte {{quote_number}} voor {{request_title}}', body: 'Er staat een nieuwe offerte klaar voor {{request_title}}. Deze is geldig tot {{valid_until}}. Log in om de offerte te bekijken.' }
    },
    placeholders: [
      { key: 'quote_number', labelKey: 'features.serviceRequests.sections.quotes', example: 'Q-2026-001' },
      { key: 'request_title', labelKey: 'features.serviceRequests.fields.title', example: 'Repair request' },
      { key: 'valid_until', labelKey: 'features.serviceRequests.fields.validUntil', example: '30 September 2026' }
    ]
  }],
  policy: {
    PROVIDER: {
      owner: serviceRequestActions,
      admin: serviceRequestActions,
      member: ['create', 'read', 'update', 'list']
    },
    CLIENT: {
      owner: ['create', 'read', 'update', 'list'],
      admin: ['create', 'read', 'update', 'list'],
      member: ['create', 'read', 'update', 'list']
    }
  }
}
