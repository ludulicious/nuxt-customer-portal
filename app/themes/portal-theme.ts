import type { ThemeProps } from '@nuxt/ui/components/Theme.vue'

type ThemeDefaults = NonNullable<ThemeProps['props']>
type ThemeUI = NonNullable<ThemeProps['ui']>

export const portalThemeNames = ['apex', 'brutal'] as const

export type PortalThemeName = typeof portalThemeNames[number]

export interface PortalThemeDefinition {
  name: PortalThemeName
  browserThemeColor: {
    light: string
    dark: string
  }
  props: ThemeDefaults
  ui: ThemeUI
}

const apexTheme = {
  name: 'apex',
  browserThemeColor: {
    light: '#ffffff',
    dark: '#0a0f1a'
  },
  props: {},
  ui: {}
} satisfies PortalThemeDefinition

const brutalTheme = {
  name: 'brutal',
  browserThemeColor: {
    light: 'oklch(96.5% 0.015 85)',
    dark: 'oklch(14.5% 0.014 25)'
  },
  props: {},
  ui: {
    alert: {
      root: 'brutal-alert'
    },
    authForm: {
      root: 'brutal-auth-form'
    },
    badge: {
      base: 'brutal-badge'
    },
    button: {
      base: 'brutal-button'
    },
    card: {
      root: 'brutal-card',
      header: 'brutal-card-header',
      footer: 'brutal-card-footer'
    },
    dashboardNavbar: {
      root: 'brutal-dashboard-navbar'
    },
    dashboardPanel: {
      root: 'brutal-dashboard-panel'
    },
    dashboardSidebar: {
      root: 'brutal-dashboard-sidebar'
    },
    dropdownMenu: {
      content: 'brutal-overlay-surface',
      item: 'brutal-menu-item'
    },
    input: {
      base: 'brutal-input'
    },
    modal: {
      content: 'brutal-overlay-surface',
      overlay: 'brutal-overlay'
    },
    navigationMenu: {
      link: 'brutal-navigation-link'
    },
    pageCard: {
      root: 'brutal-card'
    },
    popover: {
      content: 'brutal-overlay-surface'
    },
    select: {
      base: 'brutal-input',
      content: 'brutal-overlay-surface',
      item: 'brutal-menu-item'
    },
    selectMenu: {
      base: 'brutal-input',
      content: 'brutal-overlay-surface',
      item: 'brutal-menu-item'
    },
    skeleton: {
      base: 'brutal-skeleton'
    },
    slideover: {
      content: 'brutal-overlay-surface',
      overlay: 'brutal-overlay'
    },
    table: {
      root: 'brutal-table',
      thead: 'brutal-table-head',
      th: 'brutal-table-heading',
      tr: 'brutal-table-row'
    },
    tabs: {
      list: 'brutal-tabs-list',
      trigger: 'brutal-tabs-trigger',
      indicator: 'brutal-tabs-indicator'
    },
    textarea: {
      base: 'brutal-input'
    },
    toast: {
      root: 'brutal-toast'
    },
    tooltip: {
      content: 'brutal-tooltip'
    }
  }
} satisfies PortalThemeDefinition

export const portalThemes: Record<PortalThemeName, PortalThemeDefinition> = {
  apex: apexTheme,
  brutal: brutalTheme
}

export const isPortalThemeName = (value: unknown): value is PortalThemeName =>
  typeof value === 'string' && portalThemeNames.includes(value as PortalThemeName)

export const resolvePortalThemeName = (value: unknown): PortalThemeName =>
  isPortalThemeName(value) ? value : 'apex'

export const resolvePortalTheme = (value: unknown): PortalThemeDefinition =>
  portalThemes[resolvePortalThemeName(value)]
