import type { PortalFeatureDefinition } from '@nuxt-customer-portal/core/shared/types/feature'

export const accountOrganizationsFeature: PortalFeatureDefinition = {
  id: 'organizations',
  policy: { owner: [], admin: [], member: [] }
}
