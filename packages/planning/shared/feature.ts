import type { PortalFeatureDefinition } from '@nuxt-customer-portal/core/shared/types/feature'

import { canceledAppointmentEmail, newAppointmentEmail, updatedAppointmentEmail, zoomLinkReadyEmail } from './emails'

export const planningFeature: PortalFeatureDefinition<'manage' | 'read'> = {
  id: 'planning',
  emails: [newAppointmentEmail, updatedAppointmentEmail, canceledAppointmentEmail, zoomLinkReadyEmail],
  dashboardWidgets: [
    {
      id: 'planning-upcoming',
      component: 'PlanningDashboardUpcomingAppointments',
      area: 'main',
      size: 'half',
      order: 5
    },
    {
      id: 'planning-overview',
      component: 'PlanningDashboardOverview',
      area: 'main',
      size: 'half',
      order: 6
    }
  ],
  modules: [
    {
      id: 'planning',
      labelKey: 'planning.appointments',
      icon: 'i-lucide-calendar-days',
      to: '/availability',
      routePrefixes: ['/appointments', '/availability', '/planning/settings', '/admin/planning'],
      audiences: ['providerAuthenticated'],
      menuItems: [
        {
          id: 'availability',
          labelKey: 'planning.availability',
          icon: 'i-lucide-calendar-days',
          to: '/availability',
          audiences: ['providerAuthenticated'],
          exact: true
        },
        {
          id: 'planning-appointments',
          labelKey: 'planning.appointments',
          icon: 'i-lucide-calendar-check',
          to: '/appointments',
          audiences: ['providerAuthenticated']
        },
        {
          id: 'planning-personal-settings',
          labelKey: 'planning.myAppointmentSettings',
          icon: 'i-lucide-calendar-cog',
          to: '/planning/settings',
          audiences: ['providerAuthenticated'],
          exact: true
        },
        {
          id: 'planning-admin',
          labelKey: 'planning.settings',
          icon: 'i-lucide-settings',
          to: '/admin/planning',
          audiences: ['providerAdmin']
        }
      ]
    },
    {
      id: 'appointments',
      labelKey: 'planning.appointments',
      icon: 'i-lucide-calendar-check',
      to: '/appointments',
      routePrefixes: ['/appointments'],
      audiences: ['clientAuthenticated']
    }
  ],
  policy: {
    PROVIDER: { owner: ['manage', 'read'], admin: ['manage', 'read'], member: ['read'] },
    CLIENT: { owner: ['read'], admin: ['read'], member: ['read'] }
  }
}
