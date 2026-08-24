export default {
  id: 'invoice-timesheets',
  version: '0.1.0-alpha.0',
  source: '@nuxt-customer-portal/invoice-timesheets',
  dependsOn: ['core', 'invoices', 'timesheets'],
  schema: './server/db/schema/invoice-timesheets.ts',
  migrations: './migrations'
}
