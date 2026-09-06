export default {
  id: 'service-requests',
  version: '0.3.0',
  source: '@nuxt-customer-portal/service-requests',
  clientModuleId: 'service-requests',
  dependsOn: ['core', 'clients'],
  schema: './server/db/schema/service-requests.ts',
  migrations: './migrations'
}
