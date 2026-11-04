import type { InvoiceStatus } from './types/invoice'

export const invoiceLineAmount = (quantityMilli: number, unitPriceMinor: number) => {
  const amount = (quantityMilli * unitPriceMinor) / 1000
  return amount < 0 ? -Math.round(-amount) : Math.round(amount)
}

export const canCreditInvoice = (source: { status: InvoiceStatus; documentType?: string; totalMinor: number }) =>
  source.documentType !== 'credit' && ['ISSUED', 'PAID'].includes(source.status) && source.totalMinor > 0

export const copyInvoiceLines = <
  Line extends {
    quantityMilli: number
    unitPriceMinor: number
    vatRateBasisPoints: number
    exactTaxMinor?: number | null
  }
>(
  lines: Line[],
  credit: boolean
) =>
  lines.map((line) => {
    const amount = invoiceLineAmount(line.quantityMilli, line.unitPriceMinor)
    const tax = line.exactTaxMinor ?? Math.round((amount * line.vatRateBasisPoints) / 10_000)
    return {
      ...line,
      unitPriceMinor: credit ? -line.unitPriceMinor : line.unitPriceMinor,
      exactTaxMinor: credit ? -tax : (line.exactTaxMinor ?? null)
    }
  })

export const copiedInvoiceDates = (source: { issueDate: string; dueDate: string }, today = new Date()) => {
  const issueDate = today.toISOString().slice(0, 10)
  const term = Math.max(0, Date.parse(source.dueDate) - Date.parse(source.issueDate))
  return { issueDate, dueDate: new Date(Date.parse(issueDate) + term).toISOString().slice(0, 10) }
}
