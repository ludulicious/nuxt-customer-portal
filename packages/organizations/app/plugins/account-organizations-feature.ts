import { accountOrganizationsFeature } from '../../shared/feature'

export default defineNuxtPlugin(() => usePortalFeatures().registerFeature(accountOrganizationsFeature))
