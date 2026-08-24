export type PortalAudience =
  | 'public'
  | 'authenticated'
  | 'organizationAdmin'
  | 'admin'
  | 'providerAuthenticated'
  | 'providerAdmin'
  | 'clientAuthenticated'
  | 'clientAdmin'
export type PortalOrganizationRole = 'owner' | 'admin' | 'member'
export type PortalOrganizationType = 'PROVIDER' | 'CLIENT'

export interface PortalBadge {
  label: string | number
  color?: 'primary' | 'neutral' | 'success' | 'info' | 'warning' | 'error'
  variant?: 'solid' | 'outline' | 'soft' | 'subtle'
  square?: boolean
  class?: string
}

export type PortalBadgeValue = string | number | PortalBadge

export interface PortalNavigationItem {
  id: string
  labelKey: string
  icon?: string
  to: string
  audiences: PortalAudience[]
  location?: 'main' | 'admin'
  order?: number
  badge?: PortalBadgeValue
}

export interface PortalDashboardWidget {
  id: string
  component: string
  area: 'attention' | 'main' | 'aside'
  size: 'full' | 'half' | 'third'
  order: number
}

export interface PortalModuleMenuItem {
  id: string
  labelKey: string
  icon?: string
  to: string
  exact?: boolean
  audiences: PortalAudience[]
  order?: number
  badge?: PortalBadgeValue
}

export interface PortalModuleContribution {
  id: string
  labelKey: string
  icon?: string
  badge?: PortalBadgeValue
  to: string
  routePrefixes: string[]
  audiences: PortalAudience[]
  order?: number
  menuItems?: readonly PortalModuleMenuItem[]
}

export interface PortalModuleMenuContribution {
  moduleId: string
  item: PortalModuleMenuItem
}

export interface PortalRolePolicy<Action extends string = string> {
  owner: readonly Action[]
  admin: readonly Action[]
  member: readonly Action[]
}

export type PortalFeaturePolicy<Action extends string = string> =
  | PortalRolePolicy<Action>
  | {
      PROVIDER: PortalRolePolicy<Action>
      CLIENT: PortalRolePolicy<Action>
    }

export interface PortalClientIntegration {
  moduleId: string
  labelKey: string
  descriptionKey?: string
  detailComponent?: string
}

export interface PortalSurfaceContribution {
  id: string
  surface: 'administration.organization.detail'
  component: string
  order?: number
}

export interface PortalFeatureDefinition<Action extends string = string> {
  id: string
  navigation?: readonly PortalNavigationItem[]
  modules?: readonly PortalModuleContribution[]
  moduleMenuItems?: readonly PortalModuleMenuContribution[]
  dashboardWidgets?: readonly PortalDashboardWidget[]
  surfaces?: readonly PortalSurfaceContribution[]
  clientIntegration?: PortalClientIntegration
  policy: PortalFeaturePolicy<Action>
}
