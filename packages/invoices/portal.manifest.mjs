export default {
  id: 'invoices',
  version: '0.3.3',
  source: '@nuxt-customer-portal/invoices',
  clientModuleId: 'invoices',
  dependsOn: ['core', 'ui', 'organizations', 'clients'],
  schema: './server/db/schema/invoices.ts',
  migrations: './migrations'
}
