import type { InvoiceSourceProvider } from '@nuxt-customer-portal/invoices/shared/types/invoice'

export const useInvoiceSources = () => {
  const providers = useState<InvoiceSourceProvider[]>('invoice-source-providers', () => [])
  const register = (provider: InvoiceSourceProvider) => {
    providers.value = [...providers.value.filter(item => item.id !== provider.id), provider]
  }
  return { providers: readonly(providers), register }
}
