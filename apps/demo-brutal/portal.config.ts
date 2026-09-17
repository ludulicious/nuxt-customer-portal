import { definePortalConfig } from '@nuxt-customer-portal/kit'

export default definePortalConfig({
  clients: { defaultModules: ['timesheets', 'invoices', 'service-requests'] },
  layers: [
    '@nuxt-customer-portal/preset',
    '@nuxt-customer-portal/service-requests',
    '@nuxt-customer-portal/timesheets',
    '@nuxt-customer-portal/invoices',
    '@nuxt-customer-portal/invoice-timesheets',
    '@nuxt-customer-portal/products',
    '@nuxt-customer-portal/planning',
    '@nuxt-customer-portal/invoice-products'
  ]
})
