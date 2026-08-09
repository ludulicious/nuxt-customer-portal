import { definePortalConfig } from '@nuxt-customer-portal/kit'

export default definePortalConfig({
  layers: [
    '@nuxt-customer-portal/preset',
    '@nuxt-customer-portal/service-requests',
    '@nuxt-customer-portal/timesheets'
  ]
})
