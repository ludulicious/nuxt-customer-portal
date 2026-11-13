export default {
  id: 'timesheets',
  source: '@nuxt-customer-portal/timesheets',
  clientModuleId: 'timesheets',
  dependsOn: ['core', 'ui', 'organizations', 'clients'],
  schema: './server/db/schema/timesheets.ts',
  migrations: './migrations',
  migrationSearchPath: ['timesheets', 'public']
}
