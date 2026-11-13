export default {
  id: 'invoice-products',
  source: '@nuxt-customer-portal/invoice-products',
  dependsOn: ['core', 'invoices', 'products'],
  schema: './server/db/schema/invoice-products.ts',
  migrations: './migrations'
}
