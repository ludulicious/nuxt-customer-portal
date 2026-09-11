import type { PortalFeatureDefinition } from '@nuxt-customer-portal/core/shared/types/feature'

export const productsFeature: PortalFeatureDefinition<'manage' | 'read'> = {
  id: 'products',
  modules: [
    {
      id: 'products',
      labelKey: 'products.title',
      icon: 'i-lucide-shopping-bag',
      to: '/purchases',
      routePrefixes: ['/purchases', '/admin/products'],
      audiences: ['authenticated'],
      menuItems: [
        {
          id: 'catalog',
          icon: 'i-lucide-shopping-bag',
          labelKey: 'products.catalog',
          to: '/admin/products',
          audiences: ['providerAdmin'],
          exact: true
        },
        {
          id: 'categories',
          icon: 'i-lucide-tags',
          labelKey: 'products.categories',
          to: '/admin/products/categories',
          audiences: ['providerAdmin']
        },
        {
          id: 'orders',
          icon: 'i-lucide-receipt-text',
          labelKey: 'products.orders',
          to: '/admin/products/orders',
          audiences: ['providerAdmin']
        },
        {
          id: 'purchases',
          icon: 'i-lucide-library',
          labelKey: 'products.purchases',
          to: '/purchases',
          audiences: ['authenticated']
        },
        {
          id: 'store-settings',
          icon: 'i-lucide-settings',
          labelKey: 'products.settings',
          to: '/admin/products/settings',
          audiences: ['providerAdmin']
        }
      ]
    }
  ],
  policy: {
    PROVIDER: { owner: ['manage', 'read'], admin: ['manage', 'read'], member: ['read'] },
    CLIENT: { owner: ['read'], admin: ['read'], member: ['read'] }
  }
}
