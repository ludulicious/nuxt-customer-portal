export type PortalAudience = 'public' | 'authenticated' | 'organizationAdmin' | 'admin'
export type PortalOrganizationRole = 'owner' | 'admin' | 'member'

export interface PortalNavigationItem {
  id: string
  labelKey: string
  icon?: string
  to: string
  audiences: PortalAudience[]
  location?: 'main' | 'admin'
  order?: number
}

export interface PortalDashboardWidget {
  id: string
  component: string
  order?: number
}

export interface PortalFeaturePolicy<Action extends string = string> {
  owner: readonly Action[]
  admin: readonly Action[]
  member: readonly Action[]
}

export interface PortalFeatureDefinition<Action extends string = string> {
  id: string
  navigation?: readonly PortalNavigationItem[]
  dashboardWidgets?: readonly PortalDashboardWidget[]
  policy: PortalFeaturePolicy<Action>
}
