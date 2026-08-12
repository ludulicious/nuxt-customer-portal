import type { PortalFeatureDefinition } from '@nuxt-customer-portal/core/shared/types/feature'

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
      labelKey: 'features.timesheets.internalApprovals.title',
      icon: 'i-lucide-stamp',
      to: '/timesheets/internal-approvals',
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
      to: '/admin/timesheets/internal-approvals',
      audiences: ['providerAdmin'],
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
      { id: 'approval-reviewers', labelKey: 'features.timesheets.approvals.reviewersTitle', icon: 'i-lucide-users-round', to: '/timesheets/approvals/reviewers', audiences: ['clientAdmin'] },
      { id: 'supplier-timesheets', labelKey: 'features.timesheets.suppliers.title', icon: 'i-lucide-building-2', to: '/timesheets/suppliers', audiences: ['authenticated'] },
      { id: 'timesheet-approvals', labelKey: 'features.timesheets.internalApprovals.title', icon: 'i-lucide-stamp', to: '/timesheets/internal-approvals', audiences: ['authenticated'] },
      { id: 'internal-approval-settings', labelKey: 'features.timesheets.internalApprovals.manageTitle', icon: 'i-lucide-user-round-check', to: '/admin/timesheets/internal-approvals', audiences: ['providerAdmin'] },
      { id: 'timesheet-projects', labelKey: 'features.timesheets.admin.projects', icon: 'i-lucide-folder-kanban', to: '/admin/timesheets/projects', audiences: ['providerAdmin'] },
      { id: 'timesheet-activities', labelKey: 'features.timesheets.admin.activities', icon: 'i-lucide-tags', to: '/admin/timesheets/activities', audiences: ['providerAdmin'] },
      { id: 'timesheet-rates', labelKey: 'features.timesheets.admin.teamRates', icon: 'i-lucide-badge-euro', to: '/admin/timesheets/rates', audiences: ['providerAdmin'] },
      { id: 'timesheet-settings', labelKey: 'features.timesheets.admin.workspaceSettings', icon: 'i-lucide-settings-2', to: '/admin/timesheets/settings', audiences: ['providerAdmin'] },
      { id: 'timesheet-reports', labelKey: 'features.timesheets.admin.reports', icon: 'i-lucide-chart-no-axes-combined', to: '/admin/timesheets/reports', audiences: ['providerAdmin'] }
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
      { id: 'invoice-viewers', labelKey: 'features.timesheets.clientInvoices.viewersTitle', icon: 'i-lucide-users-round', to: '/timesheets/invoices/viewers', audiences: ['clientAdmin'] },
      { id: 'timesheet-invoices', labelKey: 'features.timesheets.salesInvoices', icon: 'i-lucide-send', to: '/admin/timesheets/invoices', audiences: ['providerAdmin'] }
    ]
  }],
  dashboardWidgets: [
    { id: 'timesheets-my-week', component: 'TimesheetsDashboardMyWeek', area: 'main', size: 'half', order: 20 },
    { id: 'timesheets-internal-approvals', component: 'TimesheetsDashboardInternalApprovals', area: 'attention', size: 'half', order: 10 },
    { id: 'timesheets-client-approvals', component: 'TimesheetsDashboardClientApprovals', area: 'attention', size: 'half', order: 20 },
    { id: 'timesheets-supplier-timesheets', component: 'TimesheetsDashboardSupplierTimesheets', area: 'main', size: 'half', order: 25 },
    { id: 'timesheets-sales-invoices', component: 'TimesheetsDashboardSalesInvoices', area: 'main', size: 'half', order: 30 },
    { id: 'timesheets-received-invoices', component: 'TimesheetsDashboardReceivedInvoices', area: 'main', size: 'half', order: 40 }
  ],
  clientIntegration: { moduleId: 'timesheets', labelKey: 'features.timesheets.navigation.myTimesheet', detailComponent: 'TimesheetsClientSettingsPanel' },
  policy: {
    PROVIDER: { owner: timesheetActions, admin: timesheetActions, member: ['read', 'create', 'update', 'submit'] },
    CLIENT: { owner: ['read', 'approve', 'manage'], admin: ['read', 'approve', 'manage'], member: ['read'] }
  }
}
