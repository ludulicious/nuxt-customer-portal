import { administrationFeature } from '../../shared/feature'

export default defineNuxtPlugin(() => usePortalFeatures().registerFeature(administrationFeature))
