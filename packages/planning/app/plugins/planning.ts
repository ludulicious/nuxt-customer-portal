import { planningFeature } from '../../shared/feature'

export default defineNuxtPlugin(() => {
  usePortalFeatures().registerFeature(planningFeature)
})
