import type { InvoiceLineDto } from './types/invoice'

export type InvoiceLineEdit = Pick<
  InvoiceLineDto,
  'description' | 'quantityMilli' | 'unit' | 'unitPriceMinor' | 'vatRateBasisPoints'
> & { id?: string }

export const editableInvoiceLines = (lines: InvoiceLineDto[]): InvoiceLineEdit[] =>
  lines.map(({ id, description, quantityMilli, unit, unitPriceMinor, vatRateBasisPoints }) => ({
    id,
    description,
    quantityMilli,
    unit,
    unitPriceMinor,
    vatRateBasisPoints
  }))

export const hasSameInvoiceLineAmounts = (line: InvoiceLineEdit, previous?: InvoiceLineEdit) =>
  Boolean(
    previous &&
    line.quantityMilli === previous.quantityMilli &&
    line.unitPriceMinor === previous.unitPriceMinor &&
    line.vatRateBasisPoints === previous.vatRateBasisPoints
  )

export const moveInvoiceLine = <Line>(lines: Line[], from: number, to: number): Line[] => {
  if (
    !Number.isInteger(from) ||
    !Number.isInteger(to) ||
    from < 0 ||
    to < 0 ||
    from >= lines.length ||
    to >= lines.length ||
    from === to
  ) {
    return lines
  }
  const ordered = [...lines]
  const [line] = ordered.splice(from, 1)
  ordered.splice(to, 0, line!)
  return ordered
}

export const invoiceLineErrorIndex = (errors: Array<{ name?: string }>) => {
  for (const error of errors) {
    const match = error.name?.match(/^lines\.(\d+)\./)
    if (match) {
      return Number(match[1])
    }
  }
  return undefined
}
