import { createClientsFeature } from '@nuxt-customer-portal/clients/shared/feature'

export default defineNuxtPlugin(() => {
  const config = useClientConfiguration()
  const features = usePortalFeatures()
  watch(
    () => config.value.allowedTypes,
    (types) => features.registerFeature(createClientsFeature(types ?? ['organization'])),
    { immediate: true }
  )
})
