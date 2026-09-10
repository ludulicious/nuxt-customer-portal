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
        { id: 'purchases', labelKey: 'products.purchases', to: '/purchases', audiences: ['authenticated'] },
        {
          id: 'catalog',
          labelKey: 'products.catalog',
          to: '/admin/products',
          audiences: ['providerAdmin'],
          exact: true
        },
        { id: 'orders', labelKey: 'products.orders', to: '/admin/products/orders', audiences: ['providerAdmin'] },
        {
          id: 'store-settings',
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
