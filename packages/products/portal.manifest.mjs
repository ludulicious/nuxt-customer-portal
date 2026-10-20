export default {
  id: 'products',
  version: '0.8.2',
  source: '@nuxt-customer-portal/products',
  dependsOn: ['core', 'ui', 'clients'],
  schema: './server/db/schema/products.ts',
  migrations: './migrations'
}
