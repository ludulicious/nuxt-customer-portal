import type {
  PortalFeatureDefinition,
  PortalFeaturePolicy,
  PortalOrganizationRole
} from './types/feature'

export const upsertPortalFeature = (
  features: PortalFeatureDefinition[],
  feature: PortalFeatureDefinition
): PortalFeatureDefinition[] => {
  const index = features.findIndex(item => item.id === feature.id)
  if (index === -1) return [...features, feature]
  return features.map((item, itemIndex) => itemIndex === index ? feature : item)
}

export const isPortalActionAllowed = <Action extends string>(
  policy: PortalFeaturePolicy<Action>,
  role: PortalOrganizationRole | null,
  action: Action,
  isSystemAdmin = false
): boolean => isSystemAdmin || Boolean(role && policy[role].includes(action))

export const canManageOrganizationEmailCredential = (
  role: PortalOrganizationRole | null,
  isSystemAdmin = false
): boolean => isSystemAdmin || role === 'owner'
