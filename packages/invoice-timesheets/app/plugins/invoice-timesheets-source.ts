import type { InvoiceSourceEntryDto } from '@nuxt-customer-portal/invoices/shared/types/invoice'

export default defineNuxtPlugin(() => {
  const runtimeSettings = useState<{ enabledModules?: string[] } | null>('portal-runtime-settings', () => null)
  useInvoiceSources().register({
    id: 'timesheets',
    labelKey: 'features.invoices.admin.approvedTime',
    descriptionKey: 'features.invoices.admin.approvedTimeDescription',
    load: (query) => {
      const enabledModules = runtimeSettings.value?.enabledModules
      if (
        enabledModules &&
        !['invoices', 'timesheets', 'invoice-timesheets'].every((id) => enabledModules.includes(id))
      ) {
        return Promise.resolve({ enabled: false, entries: [] })
      }
      return $fetch<{ enabled: boolean; entries: InvoiceSourceEntryDto[] }, '/api/invoice-timesheets/sources'>(
        '/api/invoice-timesheets/sources',
        { query }
      )
    },
    create: (input) =>
      $fetch<{ id: string }, '/api/invoice-timesheets/invoices'>('/api/invoice-timesheets/invoices', {
        method: 'POST',
        body: input
      })
  })
})
