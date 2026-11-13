export default {
  id: 'service-requests',
  source: '@nuxt-customer-portal/service-requests',
  clientModuleId: 'service-requests',
  dependsOn: ['core', 'clients'],
  schema: './server/db/schema/service-requests.ts',
  migrations: './migrations'
}
