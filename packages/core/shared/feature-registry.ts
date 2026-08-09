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

const dashboardAreaOrder = { attention: 0, main: 1, aside: 2 } as const

export const sortPortalDashboardWidgets = <T extends { id: string, area: keyof typeof dashboardAreaOrder, order: number }>(widgets: readonly T[]): T[] =>
  [...widgets].sort((left, right) => dashboardAreaOrder[left.area] - dashboardAreaOrder[right.area]
    || left.order - right.order
    || left.id.localeCompare(right.id))

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
