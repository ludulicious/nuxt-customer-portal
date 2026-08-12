export default defineNuxtConfig({
  $meta: { name: 'nuxt-customer-portal-preset' },
  extends: [
    '@nuxt-customer-portal/clients',
    '@nuxt-customer-portal/organizations',
    '@nuxt-customer-portal/authentication',
    '@nuxt-customer-portal/ui',
    '@nuxt-customer-portal/core'
  ]
})
