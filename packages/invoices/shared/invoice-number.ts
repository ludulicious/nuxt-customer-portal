const trailingSequence = /\d+$/

export const hasNumericInvoiceSequence = (number: string) => trailingSequence.test(number)

export const incrementInvoiceNumber = (number: string): string => {
  const match = number.match(trailingSequence)
  if (!match || match.index === undefined) {
    throw new Error('Invoice number must end with a numeric sequence')
  }
  const digits = match[0].split('')
  let carry = 1
  for (let index = digits.length - 1; index >= 0 && carry; index -= 1) {
    const next = Number(digits[index]) + carry
    digits[index] = String(next % 10)
    carry = next > 9 ? 1 : 0
  }
  if (carry) {
    digits.unshift('1')
  }
  const next = digits.join('').padStart(match[0].length, '0')
  return `${number.slice(0, match.index)}${next}`
}

export const firstInvoiceNumber = (year = new Date().getFullYear()): string => `${year}.0001`
