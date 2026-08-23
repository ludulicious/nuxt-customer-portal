import { saasConfigurationFeature } from '../../shared/feature'

export default defineNuxtPlugin(() => usePortalFeatures().registerFeature(saasConfigurationFeature))
