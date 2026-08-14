export default {
  id: 'preset',
  version: '0.1.0-alpha.0',
  source: '@nuxt-customer-portal/preset',
  dependsOn: ['core', 'ui', 'authentication', 'organizations', 'administration', 'clients'],
  includes: [
    '@nuxt-customer-portal/core',
    '@nuxt-customer-portal/ui',
    '@nuxt-customer-portal/authentication',
    '@nuxt-customer-portal/organizations',
    '@nuxt-customer-portal/administration',
    '@nuxt-customer-portal/clients'
  ]
}
