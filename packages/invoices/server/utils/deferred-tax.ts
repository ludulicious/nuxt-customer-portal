export function splitInclusiveTax(total: number, rate: number) {
  if (!Number.isSafeInteger(total) || total < 0 || !Number.isInteger(rate) || rate < 0 || rate > 10000) {
    throw new Error('Invalid inclusive tax amount or rate')
  }
  const net = Math.round((total * 10000) / (10000 + rate))
  return { net, tax: total - net, total }
}
