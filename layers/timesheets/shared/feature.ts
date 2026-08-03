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
  dashboardWidgets: [
    { id: 'timesheet-summary', component: 'TimesheetSummaryWidget', order: 30 }
  ],
  policy: {
    owner: timesheetActions,
    admin: timesheetActions,
    member: ['read', 'create', 'update', 'submit']
  }
}
