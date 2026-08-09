export default {
  id: 'service-requests',
  version: '0.1.0-alpha.0',
  source: '@nuxt-customer-portal/service-requests',
  dependsOn: ['core'],
  schema: './server/db/schema/service-requests.ts',
  migrations: './migrations'
}
