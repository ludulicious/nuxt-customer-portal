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
      to: '/admin/invoices',
      routePrefixes: ['/admin/invoices'],
      audiences: ['authenticated'],
      navigationAudiences: ['providerAdmin'],
      order: 31,
      menuItems: [
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
  moduleMenuItems: [
    {
      moduleId: 'purchases',
      item: {
        id: 'received-invoices',
        labelKey: 'features.invoices.receivedInvoices',
        icon: 'i-lucide-inbox',
        to: '/invoices',
        exact: true,
        audiences: ['clientAuthenticated']
      }
    },
    {
      moduleId: 'purchases',
      item: {
        id: 'invoice-viewers',
        labelKey: 'features.invoices.clientInvoices.viewersTitle',
        icon: 'i-lucide-users-round',
        to: '/invoices/viewers',
        audiences: ['clientOrganizationAdmin']
      }
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
          body: 'Dear {{recipient_name}},\n\nThank you for working with us. Please find invoice **{{invoice_number}}** attached to this email for your records.\n\nIf you have any questions about the invoice, please reply to this email and we will be happy to help.\n\nKind regards,  \n{{sender_name}}',
          footer: 'Please keep this email and the attached invoice for your administration.'
        },
        nl: {
          subject: 'Factuur {{invoice_number}} van {{sender_name}}',
          body: 'Beste {{recipient_name}},\n\nBedankt voor de prettige samenwerking. In de bijlage vindt u factuur **{{invoice_number}}** voor uw administratie.\n\nHeeft u vragen over de factuur? Beantwoord dan gerust deze e-mail; we helpen u graag verder.\n\nMet vriendelijke groet,  \n{{sender_name}}',
          footer: 'Bewaar deze e-mail en de bijgevoegde factuur voor uw administratie.'
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
          body: 'Dear {{recipient_name}},\n\nThis is a friendly reminder that invoice **{{invoice_number}}**, which was due on **{{due_date}}**, still has an outstanding balance of **{{outstanding_amount}}**.\n\nIt may simply have escaped your attention. Would you please arrange payment when convenient? If you have already paid, you can disregard this reminder.\n\nIf anything is unclear or you would like to discuss the invoice, please reply to this email.\n\nKind regards,  \n{{sender_name}}',
          footer: 'Thank you for your attention and for your continued cooperation.'
        },
        nl: {
          subject: 'Betalingsherinnering factuur {{invoice_number}} van {{sender_name}}',
          body: 'Beste {{recipient_name}},\n\nDit is een vriendelijke herinnering dat factuur **{{invoice_number}}**, met vervaldatum **{{due_date}}**, nog openstaat voor een bedrag van **{{outstanding_amount}}**.\n\nMogelijk is de factuur aan uw aandacht ontsnapt. Wilt u de betaling uitvoeren wanneer dat uitkomt? Als u inmiddels heeft betaald, kunt u deze herinnering als niet verzonden beschouwen.\n\nIs iets niet duidelijk of wilt u de factuur bespreken? Beantwoord dan gerust deze e-mail.\n\nMet vriendelijke groet,  \n{{sender_name}}',
          footer: 'Bedankt voor uw aandacht en de prettige samenwerking.'
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
