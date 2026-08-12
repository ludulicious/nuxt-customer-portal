import type {
  PortalFeatureDefinition,
  PortalFeaturePolicy,
  PortalOrganizationRole,
  PortalOrganizationType,
  PortalRolePolicy
} from './types/feature'

export const upsertPortalFeature = (
  features: PortalFeatureDefinition[],
  feature: PortalFeatureDefinition
): PortalFeatureDefinition[] => {
  const index = features.findIndex(item => item.id === feature.id)
  if (index === -1) return [...features, feature]
  return features.map((item, itemIndex) => itemIndex === index ? feature : item)
}

const dashboardAreaOrder = { attention: 0, main: 1, aside: 2 } as const

export const sortPortalDashboardWidgets = <T extends { id: string, area: keyof typeof dashboardAreaOrder, order: number }>(widgets: readonly T[]): T[] =>
  [...widgets].sort((left, right) => dashboardAreaOrder[left.area] - dashboardAreaOrder[right.area]
    || left.order - right.order
    || left.id.localeCompare(right.id))

export const isPortalActionAllowed = <Action extends string>(
  policy: PortalFeaturePolicy<Action>,
  role: PortalOrganizationRole | null,
  action: Action,
  organizationType: PortalOrganizationType = 'PROVIDER'
): boolean => {
  const contextual = ('PROVIDER' in policy ? policy[organizationType] : policy) as PortalRolePolicy<Action>
  return Boolean(role && contextual[role].includes(action))
}

export const canManageOrganizationEmailCredential = (
  role: PortalOrganizationRole | null,
  organizationType: PortalOrganizationType = 'PROVIDER'
): boolean => organizationType === 'PROVIDER' && role === 'owner'

export const canViewOrganizationDirectory = (
  role: PortalOrganizationRole | string | null | undefined
): boolean => role === 'owner' || role === 'admin'
