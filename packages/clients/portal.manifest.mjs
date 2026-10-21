export default {
  id: 'clients',
  version: '0.8.4',
  source: '@nuxt-customer-portal/clients',
  dependsOn: ['core', 'ui'],
  schema: './server/db/schema/clients.ts',
  migrations: './migrations'
}
