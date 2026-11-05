import type { InvoiceSourceProvider } from './types/invoice'

export const loadAvailableInvoiceSources = async (
  providers: readonly InvoiceSourceProvider[],
  query: { from: string; to: string }
) => {
  const results = await Promise.allSettled(providers.map(async (provider) => provider.load(query)))
  return {
    available: providers.filter((_, index) => {
      const result = results[index]!
      return result.status === 'fulfilled' && result.value.enabled
    }),
    failed: results.some((result) => result.status === 'rejected')
  }
}
