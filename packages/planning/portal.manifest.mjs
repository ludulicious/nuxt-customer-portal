export default {
  id: 'planning',
  version: '0.4.2',
  source: '@nuxt-customer-portal/planning',
  dependsOn: ['core', 'ui', 'products'],
  schema: './server/db/schema/planning.ts',
  migrations: './migrations'
}
