export default {
  id: 'clients',
  version: '0.10.1',
  source: '@nuxt-customer-portal/clients',
  dependsOn: ['core', 'ui'],
  schema: './server/db/schema/clients.ts',
  migrations: './migrations'
}
