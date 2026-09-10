import { createClientsFeature } from '@nuxt-customer-portal/clients/shared/feature'

export default defineNuxtPlugin(() => {
  const allowedTypes = useRuntimeConfig().public.clients?.allowedTypes ?? ['organization']
  usePortalFeatures().registerFeature(createClientsFeature(allowedTypes))
})
