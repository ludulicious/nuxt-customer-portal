export default {
  id: 'invoices',
  source: '@nuxt-customer-portal/invoices',
  clientModuleId: 'invoices',
  dependsOn: ['core', 'ui', 'organizations', 'clients'],
  schema: './server/db/schema/invoices.ts',
  migrations: './migrations'
}
