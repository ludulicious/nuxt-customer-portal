export default {
  id: 'invoice-products',
  version: '0.12.1',
  source: '@nuxt-customer-portal/invoice-products',
  dependsOn: ['core', 'invoices', 'products'],
  schema: './server/db/schema/invoice-products.ts',
  migrations: './migrations'
}
