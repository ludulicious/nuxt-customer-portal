import type {
  ClientInvoiceDto,
  ClientInvoiceSupplierDto,
  ClientInvoiceViewerDto,
  InvoiceClientDto,
  InvoiceClientAccessOverviewDto,
  InvoiceDto,
  InvoiceEmailPreviewDto,
  InvoiceEmailStatusRefreshDto,
  InvoiceSettingsDto
} from '@nuxt-customer-portal/invoices/shared/types/invoice'

export interface InvoicesAdminBootstrap {
  settings: InvoiceSettingsDto
  clients: InvoiceClientDto[]
  organizationProfile: InvoiceSettingsDto & { name: string; logo: string | null }
}

export const useInvoices = () => ({
  clientAccessOverview: (clientId: string) =>
    $fetch<InvoiceClientAccessOverviewDto, string>(`/api/invoices/admin/clients/${clientId}/access`),
  adminBootstrap: () => $fetch<InvoicesAdminBootstrap, string>('/api/invoices/admin/bootstrap'),
  updateSettings: (input: Omit<InvoiceSettingsDto, 'organizationId'>) =>
    $fetch<unknown, string>('/api/invoices/admin/settings', { method: 'PUT', body: input }),
  createInvoice: (input: Record<string, unknown>) =>
    $fetch<{ id: string }, string>('/api/invoices/admin/invoices', { method: 'POST', body: input }),
  getNextInvoiceNumber: () => $fetch<{ number: string }, string>('/api/invoices/admin/invoices/next-number'),
  getInvoice: (id: string) => $fetch<InvoiceDto, string>(`/api/invoices/admin/invoices/${id}`),
  updateInvoice: (id: string, input: Record<string, unknown>) =>
    $fetch<unknown, string>(`/api/invoices/admin/invoices/${id}`, { method: 'PATCH' as never, body: input }),
  changeInvoiceStatus: (id: string, action: 'VOID' | 'UNVOID') =>
    $fetch<unknown, string>(`/api/invoices/admin/invoices/${id}`, { method: 'PATCH' as never, body: { action } }),
  getInvoiceEmailPreview: (id: string, locale?: string, purpose?: 'resend') =>
    $fetch<InvoiceEmailPreviewDto, string>(`/api/invoices/admin/invoices/${id}/email-preview`, {
      query: { locale, purpose }
    }),
  issueAndSendInvoice: (id: string, input: Record<string, unknown>) =>
    $fetch<unknown, string>(`/api/invoices/admin/invoices/${id}/issue`, { method: 'POST', body: input }),
  resendInvoice: (id: string, input: Record<string, unknown>) =>
    $fetch<unknown, string>(`/api/invoices/admin/invoices/${id}/email`, { method: 'POST', body: input }),
  getInvoiceReminderPreview: (id: string, locale?: string) =>
    $fetch<InvoiceEmailPreviewDto, string>(`/api/invoices/admin/invoices/${id}/reminder-preview`, {
      query: { locale }
    }),
  sendInvoiceReminder: (id: string, input: Record<string, unknown>) =>
    $fetch<unknown, string>(`/api/invoices/admin/invoices/${id}/reminder`, { method: 'POST', body: input }),
  refreshInvoiceEmailStatuses: (id: string, forceRefresh = false) =>
    $fetch<InvoiceEmailStatusRefreshDto, string>(`/api/invoices/admin/invoices/${id}/email-status`, {
      method: 'POST',
      query: forceRefresh ? { refresh: '1' } : undefined
    }),
  registerInvoicePayment: (id: string, input: Record<string, unknown>) =>
    $fetch<unknown, string>(`/api/invoices/admin/invoices/${id}/payments`, { method: 'POST', body: input }),
  uploadInvoiceAttachment: (id: string, file: File) => {
    const body = new FormData()
    body.append('file', file)
    return $fetch<unknown, string>(`/api/invoices/admin/invoices/${id}/attachments`, { method: 'POST', body })
  },
  addInvoiceAttachment: (id: string, file: File) => {
    const body = new FormData()
    body.append('file', file)
    return $fetch<unknown, string>(`/api/invoices/admin/invoices/${id}/attachments`, { method: 'POST', body })
  },
  deleteInvoiceAttachment: (id: string, attachmentId: string) =>
    $fetch<unknown, string>(`/api/invoices/admin/invoices/${id}/attachments/${attachmentId}`, { method: 'DELETE' }),
  clientInvoiceSuppliers: () => $fetch<ClientInvoiceSupplierDto[], string>('/api/invoices/client/suppliers'),
  clientInvoiceViewers: (accessId: string) =>
    $fetch<ClientInvoiceViewerDto[], string>(`/api/invoices/client/${accessId}/viewers`),
  setClientInvoiceViewer: (accessId: string, userId: string, assigned: boolean) =>
    $fetch<unknown, string>(`/api/invoices/client/${accessId}/viewers`, { method: 'PUT', body: { userId, assigned } }),
  getClientInvoice: (id: string) => $fetch<ClientInvoiceDto, string>(`/api/invoices/client/invoices/${id}`)
})
