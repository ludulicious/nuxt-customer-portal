export default {
  id: 'products',
  version: '0.4.1',
  source: '@nuxt-customer-portal/products',
  dependsOn: ['core', 'ui', 'clients'],
  schema: './server/db/schema/products.ts',
  migrations: './migrations'
}
