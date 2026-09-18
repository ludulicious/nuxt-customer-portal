export default {
  id: 'planning',
  version: '0.4.1',
  source: '@nuxt-customer-portal/planning',
  dependsOn: ['core', 'ui', 'products'],
  schema: './server/db/schema/planning.ts',
  migrations: './migrations'
}
