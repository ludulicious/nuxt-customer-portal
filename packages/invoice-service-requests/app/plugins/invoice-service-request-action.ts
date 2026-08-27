export default defineNuxtPlugin(() => {
  const { register } = useServiceRequestCommercialActions()
  register({
    id: 'create-invoice', label: 'Create draft invoice', icon: 'i-lucide-receipt-text',
    available: (_request, quote) => quote.status === 'ACCEPTED',
    run: async (request, quote) => {
      const { number } = await $fetch<{ number: string }>('/api/invoices/admin/invoices/next-number')
      const issueDate = new Date().toISOString().slice(0, 10)
      const dueDate = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10)
      const invoice = await $fetch<{ id: string }>('/api/invoice-service-requests/invoices', { method: 'POST', body: {
        requestId: request.id, quoteId: quote.id, clientOrganizationId: request.clientOrganizationId,
        number, currency: quote.currency, issueDate, dueDate, subject: request.title, notes: quote.notes,
        lines: quote.lines.map(({ description, quantityMilli, unit, unitPriceMinor, vatRateBasisPoints }) => ({ description, quantityMilli, unit, unitPriceMinor, vatRateBasisPoints }))
      } })
      return { to: `/admin/invoices/${invoice.id}` }
    }
  })
})
