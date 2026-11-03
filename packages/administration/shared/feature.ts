import type { PortalFeatureDefinition } from '@nuxt-customer-portal/core/shared/types/feature'

export const administrationFeature: PortalFeatureDefinition = {
  id: 'administration',
  navigation: [
    {
      id: 'admin',
      labelKey: 'nav.admin',
      icon: 'i-lucide-shield-check',
      to: '/admin/organizations',
      audiences: ['admin'],
      order: 100
    }
  ],
  modules: [
    {
      id: 'admin',
      labelKey: 'nav.admin',
      icon: 'i-lucide-shield-check',
      to: '/admin/organizations',
      routePrefixes: ['/admin'],
      audiences: ['admin'],
      order: 100,
      menuItems: [
        {
          id: 'admin-organizations',
          labelKey: 'admin.menu.organizations',
          icon: 'i-lucide-building-2',
          to: '/admin/organizations',
          audiences: ['admin'],
          order: 10
        },
        {
          id: 'admin-users',
          labelKey: 'admin.menu.users',
          icon: 'i-lucide-users',
          to: '/admin/users',
          audiences: ['admin'],
          order: 20
        },
        {
          id: 'admin-api-keys',
          labelKey: 'admin.apiKeys.title',
          icon: 'i-lucide-key-round',
          to: '/admin/api-keys',
          audiences: ['admin'],
          order: 30
        },
        {
          id: 'admin-email',
          labelKey: 'admin.email.textPage',
          icon: 'i-lucide-mail',
          to: '/admin/email-texts',
          audiences: ['admin'],
          order: 40
        }
      ]
    }
  ],
  surfaces: [
    {
      id: 'email-provider',
      surface: 'administration.portal-settings',
      component: 'AdminEmailProviderSettings',
      labelKey: 'admin.email.providerPage',
      order: 10
    },
    {
      id: 'email-template',
      surface: 'administration.portal-settings',
      component: 'AdminEmailTemplateSettings',
      labelKey: 'admin.email.templatePage',
      order: 20
    }
  ],
  policy: { owner: [], admin: [], member: [] }
}
