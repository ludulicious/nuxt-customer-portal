export default {
  id: 'invoice-timesheets',
  version: '0.4.5',
  source: '@nuxt-customer-portal/invoice-timesheets',
  dependsOn: ['core', 'invoices', 'timesheets'],
  schema: './server/db/schema/invoice-timesheets.ts',
  migrations: './migrations'
}
