import type { PortalFeatureDefinition } from '@nuxt-customer-portal/core/shared/types/feature'

import { appointmentEmail } from './emails'

export const planningFeature: PortalFeatureDefinition<'manage' | 'read'> = {
  id: 'planning',
  emails: [appointmentEmail],
  modules: [
    {
      id: 'planning',
      labelKey: 'planning.appointments',
      icon: 'i-lucide-calendar-days',
      to: '/appointments',
      routePrefixes: ['/appointments', '/planning', '/admin/planning'],
      audiences: ['providerAuthenticated'],
      menuItems: [
        {
          id: 'availability',
          labelKey: 'planning.availability',
          icon: 'i-lucide-calendar-days',
          to: '/planning',
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
