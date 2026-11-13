export default {
  id: 'planning',
  source: '@nuxt-customer-portal/planning',
  dependsOn: ['core', 'ui', 'products'],
  schema: './server/db/schema/planning.ts',
  migrations: './migrations'
}
