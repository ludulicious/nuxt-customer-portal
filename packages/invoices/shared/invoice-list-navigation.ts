export interface InvoiceListPosition {
  firstPage: number
  lastPage: number
  scrollTop: number
}

export const parseInvoiceListPosition = (value: string | null): InvoiceListPosition | undefined => {
  try {
    const position = JSON.parse(value ?? 'null') as InvoiceListPosition | null
    if (
      position &&
      Number.isSafeInteger(position.firstPage) &&
      position.firstPage > 0 &&
      Number.isSafeInteger(position.lastPage) &&
      position.lastPage >= position.firstPage &&
      Number.isFinite(position.scrollTop) &&
      position.scrollTop >= 0
    ) {
      return position
    }
  } catch {
    return undefined
  }
}

export const invoiceListReturnTo = (value: unknown) =>
  typeof value === 'string' && /^\/admin\/invoices(?:\?|$)/.test(value) ? value : undefined
