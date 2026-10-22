export default {
  id: 'invoice-timesheets',
  version: '0.8.7',
  source: '@nuxt-customer-portal/invoice-timesheets',
  dependsOn: ['core', 'invoices', 'timesheets'],
  schema: './server/db/schema/invoice-timesheets.ts',
  migrations: './migrations'
}
