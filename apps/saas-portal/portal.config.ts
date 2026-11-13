import { definePortalConfig } from '@nuxt-customer-portal/core/config'

export default definePortalConfig({
  clients: {
    allowedTypes: ['organization', 'person'],
    personalSelfRegistration: false,
    defaultModules: ['timesheets', 'invoices']
  },
  layers: [
    '@nuxt-customer-portal/administration',
    '@nuxt-customer-portal/clients',
    '@nuxt-customer-portal/organizations',
    '@nuxt-customer-portal/authentication',
    '@nuxt-customer-portal/ui',
    '@nuxt-customer-portal/core',
    '@nuxt-customer-portal/service-requests',
    '@nuxt-customer-portal/timesheets',
    '@nuxt-customer-portal/invoices',
    '@nuxt-customer-portal/invoice-timesheets',
    '@nuxt-customer-portal/products',
    '@nuxt-customer-portal/planning',
    '@nuxt-customer-portal/invoice-products',
    '@nuxt-customer-portal/saas-configuration'
  ]
})
