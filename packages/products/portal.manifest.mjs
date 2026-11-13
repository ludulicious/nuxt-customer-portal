export default {
  id: 'products',
  source: '@nuxt-customer-portal/products',
  dependsOn: ['core', 'ui', 'clients'],
  schema: './server/db/schema/products.ts',
  migrations: './migrations'
}
