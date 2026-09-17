import type { PortalFeatureDefinition } from '@nuxt-customer-portal/core/shared/types/feature'
import { purchaseConfirmationEmail } from './emails'

export const productsFeature: PortalFeatureDefinition<'manage' | 'read'> = {
  id: 'products',
  emails: [purchaseConfirmationEmail],
  apiScopes: [
    {
      id: 'products.catalog',
      action: 'read',
      labelKey: 'products.catalogReadScope',
      descriptionKey: 'products.catalogReadScopeHelp'
    },
    {
      id: 'products.drafts',
      action: 'read',
      labelKey: 'products.draftsReadScope',
      descriptionKey: 'products.draftsReadScopeHelp'
    }
  ],
  modules: [
    {
      id: 'products',
      labelKey: 'products.store',
      icon: 'i-lucide-shopping-bag',
      to: '/admin/products',
      routePrefixes: ['/admin/products'],
      audiences: ['providerAdmin'],
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
          id: 'store-settings',
          icon: 'i-lucide-settings',
          labelKey: 'products.settings',
          to: '/admin/products/settings',
          audiences: ['providerAdmin']
        }
      ]
    },
    {
      id: 'purchases',
      labelKey: 'products.purchasesModule',
      icon: 'i-lucide-library',
      to: '/purchases',
      routePrefixes: ['/purchases', '/invoices'],
      audiences: ['clientAuthenticated'],
      menuItems: [
        {
          id: 'purchases',
          icon: 'i-lucide-library',
          labelKey: 'products.purchases',
          to: '/purchases',
          audiences: ['clientAuthenticated'],
          exact: true
        }
      ]
    }
  ],
  policy: {
    PROVIDER: { owner: ['manage', 'read'], admin: ['manage', 'read'], member: ['read'] },
    CLIENT: { owner: ['read'], admin: ['read'], member: ['read'] }
  }
}
