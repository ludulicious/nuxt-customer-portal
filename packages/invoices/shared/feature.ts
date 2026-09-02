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
          icon: 'i-lucide-receipt-text',
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
    { id: 'invoices-sales', component: 'InvoicesDashboardSalesInvoices', area: 'main', size: 'half', order: 15 },
    { id: 'invoices-received', component: 'InvoicesDashboardReceivedInvoices', area: 'main', size: 'half', order: 40 }
  ],
  clientIntegration: {
    moduleId: 'invoices',
    labelKey: 'features.invoices.title',
    detailComponent: 'InvoicesClientSettingsPanel'
  },
  emails: [
    {
      id: 'invoice',
      labelKey: 'features.invoices.admin.emailMessages.invoice',
      defaults: {
        en: {
          subject: 'Invoice {{invoice_number}} from {{sender_name}}',
          body: 'Dear Sir or Madam,<br><br>Please find invoice {{invoice_number}} attached.<br><br>Kind regards,<br>{{sender_name}}'
        },
        nl: {
          subject: 'Factuur {{invoice_number}} van {{sender_name}}',
          body: 'Geachte heer/mevrouw,<br><br>In de bijlage vindt u factuur {{invoice_number}}.<br><br>Met vriendelijke groet,<br>{{sender_name}}'
        }
      },
      placeholders: [
        {
          key: 'invoice_number',
          labelKey: 'features.invoices.admin.emailPlaceholders.invoiceNumber',
          example: '2026-001'
        },
        {
          key: 'sender_name',
          labelKey: 'features.invoices.admin.emailPlaceholders.senderName',
          example: 'Example Company'
        },
        {
          key: 'recipient_name',
          labelKey: 'features.invoices.admin.emailPlaceholders.recipientName',
          example: 'Example Client'
        },
        {
          key: 'due_date',
          labelKey: 'features.invoices.admin.emailPlaceholders.dueDate',
          example: '30 September 2026'
        },
        {
          key: 'outstanding_amount',
          labelKey: 'features.invoices.admin.emailPlaceholders.outstandingAmount',
          example: '€1,250.00'
        }
      ]
    },
    {
      id: 'payment-reminder',
      labelKey: 'features.invoices.admin.emailMessages.paymentReminder',
      defaults: {
        en: {
          subject: 'Payment reminder for invoice {{invoice_number}} from {{sender_name}}',
          body: 'Dear Sir or Madam,<br><br>Invoice {{invoice_number}}, due on {{due_date}}, remains outstanding for {{outstanding_amount}}. Please arrange payment.<br><br>Kind regards,<br>{{sender_name}}'
        },
        nl: {
          subject: 'Betalingsherinnering factuur {{invoice_number}} van {{sender_name}}',
          body: 'Geachte heer/mevrouw,<br><br>Factuur {{invoice_number}}, met vervaldatum {{due_date}}, staat nog open voor {{outstanding_amount}}. Wij verzoeken u vriendelijk te betalen.<br><br>Met vriendelijke groet,<br>{{sender_name}}'
        }
      },
      placeholders: [
        {
          key: 'invoice_number',
          labelKey: 'features.invoices.admin.emailPlaceholders.invoiceNumber',
          example: '2026-001'
        },
        {
          key: 'sender_name',
          labelKey: 'features.invoices.admin.emailPlaceholders.senderName',
          example: 'Example Company'
        },
        {
          key: 'recipient_name',
          labelKey: 'features.invoices.admin.emailPlaceholders.recipientName',
          example: 'Example Client'
        },
        {
          key: 'due_date',
          labelKey: 'features.invoices.admin.emailPlaceholders.dueDate',
          example: '30 September 2026'
        },
        {
          key: 'outstanding_amount',
          labelKey: 'features.invoices.admin.emailPlaceholders.outstandingAmount',
          example: '€1,250.00'
        }
      ]
    }
  ],
  policy: {
    PROVIDER: { owner: invoiceActions, admin: invoiceActions, member: [] },
    CLIENT: { owner: ['read', 'manage'], admin: ['read', 'manage'], member: ['read'] }
  }
}
