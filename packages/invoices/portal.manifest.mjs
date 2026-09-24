export default {
  id: 'invoices',
  version: '0.4.6',
  source: '@nuxt-customer-portal/invoices',
  clientModuleId: 'invoices',
  dependsOn: ['core', 'ui', 'organizations', 'clients'],
  schema: './server/db/schema/invoices.ts',
  migrations: './migrations'
}
