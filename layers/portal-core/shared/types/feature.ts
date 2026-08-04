import type { BadgeProps } from '@nuxt/ui'
import type { Component } from 'vue'

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
  badge?: string | number | BadgeProps
}

export interface PortalDashboardWidget {
  id: string
  component: string | Component
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
  badge?: string | number | BadgeProps
}

export interface PortalModuleContribution {
  id: string
  labelKey: string
  icon?: string
  badge?: string | number | BadgeProps
  to: string
  routePrefixes: string[]
  audiences: PortalAudience[]
  order?: number
  menuItems?: readonly PortalModuleMenuItem[]
}

export interface PortalFeaturePolicy<Action extends string = string> {
  owner: readonly Action[]
  admin: readonly Action[]
  member: readonly Action[]
}

export interface PortalFeatureDefinition<Action extends string = string> {
  id: string
  navigation?: readonly PortalNavigationItem[]
  modules?: readonly PortalModuleContribution[]
  dashboardWidgets?: readonly PortalDashboardWidget[]
  policy: PortalFeaturePolicy<Action>
}
