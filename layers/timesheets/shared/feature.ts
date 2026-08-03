import type { PortalFeatureDefinition } from '#portal/shared/types/feature'

export const timesheetActions = [
  'read',
  'create',
  'update',
  'submit',
  'report',
  'approve',
  'manage'
] as const

export type TimesheetAction = typeof timesheetActions[number]

export const timesheetsFeature: PortalFeatureDefinition<TimesheetAction> = {
  id: 'timesheets',
  navigation: [
    {
      id: 'timesheets',
      labelKey: 'features.timesheets.navigation.myTimesheet',
      icon: 'i-lucide-clock-3',
      to: '/timesheets',
      audiences: ['authenticated'],
      order: 30
    },
    {
      id: 'timesheets-admin',
      labelKey: 'features.timesheets.navigation.manage',
      icon: 'i-lucide-chart-no-axes-combined',
      to: '/admin/timesheets/approvals',
      audiences: ['organizationAdmin', 'admin'],
      location: 'admin',
      order: 130
    }
  ],
  modules: [{
    id: 'timesheets',
    labelKey: 'features.timesheets.navigation.myTimesheet',
    icon: 'i-lucide-clock-3',
    to: '/timesheets',
    routePrefixes: ['/timesheets', '/admin/timesheets'],
    audiences: ['authenticated'],
    order: 30,
    menuItems: [
      { id: 'my-timesheet', labelKey: 'features.timesheets.navigation.myTimesheet', icon: 'i-lucide-clock-3', to: '/timesheets', audiences: ['authenticated'] },
      { id: 'manage-timesheets', labelKey: 'features.timesheets.navigation.manage', icon: 'i-lucide-chart-no-axes-combined', to: '/admin/timesheets', audiences: ['organizationAdmin', 'admin'] }
    ]
  }],
  dashboardWidgets: [
    { id: 'timesheet-summary', component: 'TimesheetSummaryWidget', order: 30 }
  ],
  policy: {
    owner: timesheetActions,
    admin: timesheetActions,
    member: ['read', 'create', 'update', 'submit']
  }
}
