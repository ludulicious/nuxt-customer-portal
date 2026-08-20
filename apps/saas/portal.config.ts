import { definePortalConfig } from '@nuxt-customer-portal/kit'

export default definePortalConfig({
  clients: { defaultModules: ['timesheets', 'invoices'] },
  layers: [
    '@nuxt-customer-portal/preset',
    '@nuxt-customer-portal/timesheets',
    '@nuxt-customer-portal/invoices',
    '@nuxt-customer-portal/invoice-timesheets'
  ]
})
