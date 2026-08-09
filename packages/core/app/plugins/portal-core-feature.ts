import { coreFeature } from '../../shared/core-feature'

export default defineNuxtPlugin(() => usePortalFeatures().registerFeature(coreFeature))
