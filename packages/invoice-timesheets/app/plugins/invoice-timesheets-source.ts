export default defineNuxtPlugin(() => {
  useInvoiceSources().register({
    id: 'timesheets',
    labelKey: 'features.invoices.admin.approvedTime',
    descriptionKey: 'features.invoices.admin.approvedTimeDescription',
    load: (query) => $fetch('/api/invoice-timesheets/sources', { query }),
    create: (input) => $fetch('/api/invoice-timesheets/invoices', { method: 'POST', body: input })
  })
})
