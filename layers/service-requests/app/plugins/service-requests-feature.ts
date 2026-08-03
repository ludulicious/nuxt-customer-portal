import { serviceRequestFeature } from '#layers/service-requests/shared/feature'

export default defineNuxtPlugin(() => {
  const { registerFeature } = usePortalFeatures()
  registerFeature(serviceRequestFeature)
})
