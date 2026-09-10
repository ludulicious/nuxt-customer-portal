import { productsFeature } from '@nuxt-customer-portal/products/shared/feature'

export default defineNuxtPlugin(() => {
  usePortalFeatures().registerFeature(productsFeature)
})
