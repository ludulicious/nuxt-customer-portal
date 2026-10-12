import type { InvoiceSourceEntryDto } from '@nuxt-customer-portal/invoices/shared/types/invoice'

export default defineNuxtPlugin(() => {
  useInvoiceSources().register({
    id: 'timesheets',
    labelKey: 'features.invoices.admin.approvedTime',
    descriptionKey: 'features.invoices.admin.approvedTimeDescription',
    load: (query) =>
      $fetch<{ enabled: boolean; entries: InvoiceSourceEntryDto[] }>('/api/invoice-timesheets/sources', { query }),
    create: (input) => $fetch<{ id: string }>('/api/invoice-timesheets/invoices', { method: 'POST', body: input })
  })
})
