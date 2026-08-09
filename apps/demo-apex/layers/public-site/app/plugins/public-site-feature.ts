import { publicSiteFeature } from '../../shared/feature'

export default defineNuxtPlugin(() => usePortalFeatures().registerFeature(publicSiteFeature))
