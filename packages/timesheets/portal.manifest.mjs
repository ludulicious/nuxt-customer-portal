export default {
  id: 'timesheets',
  version: '0.1.0-alpha.0',
  source: '@nuxt-customer-portal/timesheets',
  dependsOn: ['core', 'ui', 'organizations'],
  schema: './server/db/schema/timesheets.ts',
  migrations: './migrations'
}
