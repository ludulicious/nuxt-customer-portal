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
      id: 'timesheets-approvals',
      labelKey: 'features.timesheets.approvals.title',
      icon: 'i-lucide-stamp',
      to: '/timesheets/approvals',
      audiences: ['authenticated'],
      order: 31
    },
    {
      id: 'timesheets-suppliers',
      labelKey: 'features.timesheets.suppliers.title',
      icon: 'i-lucide-building-2',
      to: '/timesheets/suppliers',
      audiences: ['authenticated'],
      order: 32
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
      { id: 'client-approvals', labelKey: 'features.timesheets.approvals.title', icon: 'i-lucide-stamp', to: '/timesheets/approvals', exact: true, audiences: ['authenticated'] },
      { id: 'approval-reviewers', labelKey: 'features.timesheets.approvals.reviewersTitle', icon: 'i-lucide-users-round', to: '/timesheets/approvals/reviewers', audiences: ['organizationAdmin', 'admin'] },
      { id: 'supplier-timesheets', labelKey: 'features.timesheets.suppliers.title', icon: 'i-lucide-building-2', to: '/timesheets/suppliers', audiences: ['authenticated'] },
      { id: 'timesheet-approvals', labelKey: 'features.timesheets.admin.approvals', icon: 'i-lucide-stamp', to: '/admin/timesheets/approvals', audiences: ['organizationAdmin', 'admin'] },
      { id: 'timesheet-clients', labelKey: 'features.timesheets.admin.clients', icon: 'i-lucide-building-2', to: '/admin/timesheets/clients', audiences: ['organizationAdmin', 'admin'] },
      { id: 'timesheet-projects', labelKey: 'features.timesheets.admin.projects', icon: 'i-lucide-folder-kanban', to: '/admin/timesheets/projects', audiences: ['organizationAdmin', 'admin'] },
      { id: 'timesheet-activities', labelKey: 'features.timesheets.admin.activities', icon: 'i-lucide-tags', to: '/admin/timesheets/activities', audiences: ['organizationAdmin', 'admin'] },
      { id: 'timesheet-rates', labelKey: 'features.timesheets.admin.teamRates', icon: 'i-lucide-badge-euro', to: '/admin/timesheets/rates', audiences: ['organizationAdmin', 'admin'] },
      { id: 'timesheet-settings', labelKey: 'features.timesheets.admin.workspaceSettings', icon: 'i-lucide-settings-2', to: '/admin/timesheets/settings', audiences: ['organizationAdmin', 'admin'] },
      { id: 'timesheet-reports', labelKey: 'features.timesheets.admin.reports', icon: 'i-lucide-chart-no-axes-combined', to: '/admin/timesheets/reports', audiences: ['organizationAdmin', 'admin'] }
    ]
  }, {
    id: 'invoices',
    labelKey: 'features.timesheets.clientInvoices.title',
    icon: 'i-lucide-receipt-text',
    to: '/timesheets/invoices',
    routePrefixes: ['/timesheets/invoices', '/admin/timesheets/invoices'],
    audiences: ['authenticated'],
    order: 31,
    menuItems: [
      { id: 'client-invoices', labelKey: 'features.timesheets.receivedInvoices', icon: 'i-lucide-inbox', to: '/timesheets/invoices', exact: true, audiences: ['authenticated'] },
      { id: 'invoice-viewers', labelKey: 'features.timesheets.clientInvoices.viewersTitle', icon: 'i-lucide-users-round', to: '/timesheets/invoices/viewers', audiences: ['organizationAdmin', 'admin'] },
      { id: 'timesheet-invoices', labelKey: 'features.timesheets.salesInvoices', icon: 'i-lucide-send', to: '/admin/timesheets/invoices', audiences: ['organizationAdmin', 'admin'] }
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
