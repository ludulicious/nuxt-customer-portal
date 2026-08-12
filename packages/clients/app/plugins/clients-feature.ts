import { clientsFeature } from '@nuxt-customer-portal/clients/shared/feature'

export default defineNuxtPlugin(() => usePortalFeatures().registerFeature(clientsFeature))
