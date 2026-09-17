export default {
  id: 'planning',
  version: '0.3.3',
  source: '@nuxt-customer-portal/planning',
  dependsOn: ['core', 'ui', 'products'],
  schema: './server/db/schema/planning.ts',
  migrations: './migrations'
}
