const trailingSequence = /\d+$/

export const hasNumericInvoiceSequence = (number: string) => trailingSequence.test(number)

export const incrementInvoiceNumber = (number: string): string => {
  const match = number.match(trailingSequence)
  if (!match || match.index === undefined) throw new Error('Invoice number must end with a numeric sequence')
  const next = (BigInt(match[0]) + 1n).toString().padStart(match[0].length, '0')
  return `${number.slice(0, match.index)}${next}`
}

export const firstInvoiceNumber = (year = new Date().getFullYear()): string => `${year}.0001`
