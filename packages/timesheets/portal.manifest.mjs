export default {
  id: 'timesheets',
  version: '0.3.3',
  source: '@nuxt-customer-portal/timesheets',
  clientModuleId: 'timesheets',
  dependsOn: ['core', 'ui', 'organizations', 'clients'],
  schema: './server/db/schema/timesheets.ts',
  migrations: './migrations',
  migrationSearchPath: ['timesheets', 'public']
}
