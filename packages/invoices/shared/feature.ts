import type { PortalFeatureDefinition } from '@nuxt-customer-portal/core/shared/types/feature'

export const invoiceActions = ['read', 'create', 'update', 'manage'] as const
export type InvoiceAction = (typeof invoiceActions)[number]

export const invoicesFeature: PortalFeatureDefinition<InvoiceAction> = {
  id: 'invoices',
  modules: [
    {
      id: 'invoices',
      labelKey: 'features.invoices.title',
      icon: 'i-lucide-receipt-text',
      to: '/invoices',
      routePrefixes: ['/invoices', '/admin/invoices'],
      audiences: ['authenticated'],
      order: 31,
      menuItems: [
        {
          id: 'received-invoices',
          labelKey: 'features.invoices.receivedInvoices',
          icon: 'i-lucide-inbox',
          to: '/invoices',
          exact: true,
          audiences: ['authenticated']
        },
        {
          id: 'invoice-viewers',
          labelKey: 'features.invoices.clientInvoices.viewersTitle',
          icon: 'i-lucide-users-round',
          to: '/invoices/viewers',
          audiences: ['clientAdmin']
        },
        {
          id: 'sales-invoices',
          labelKey: 'features.invoices.salesInvoices',
          icon: 'i-lucide-send',
          to: '/admin/invoices',
          exact: true,
          audiences: ['providerAdmin']
        },
        {
          id: 'invoice-settings',
          labelKey: 'features.invoices.admin.workspaceSettings',
          icon: 'i-lucide-settings-2',
          to: '/admin/invoices/settings',
          audiences: ['providerAdmin']
        }
      ]
    }
  ],
  dashboardWidgets: [
    { id: 'invoices-sales', component: 'InvoicesDashboardSalesInvoices', area: 'main', size: 'half', order: 30 },
    { id: 'invoices-received', component: 'InvoicesDashboardReceivedInvoices', area: 'main', size: 'half', order: 40 }
  ],
  clientIntegration: {
    moduleId: 'invoices',
    labelKey: 'features.invoices.title',
    detailComponent: 'InvoicesClientSettingsPanel'
  },
  policy: {
    PROVIDER: { owner: invoiceActions, admin: invoiceActions, member: [] },
    CLIENT: { owner: ['read', 'manage'], admin: ['read', 'manage'], member: ['read'] }
  }
}
