export default {
  id: 'invoice-timesheets',
  version: '0.3.1',
  source: '@nuxt-customer-portal/invoice-timesheets',
  dependsOn: ['core', 'invoices', 'timesheets'],
  schema: './server/db/schema/invoice-timesheets.ts',
  migrations: './migrations'
}
