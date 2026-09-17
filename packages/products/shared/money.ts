export const currencyScale = (currency: string) => {
  try {
    return (
      10 ** (new Intl.NumberFormat('en', { style: 'currency', currency }).resolvedOptions().maximumFractionDigits ?? 2)
    )
  } catch {
    return 100
  }
}
export const formatMoney = (amount: number, currency: string, locale = 'en') =>
  new Intl.NumberFormat(locale, { style: 'currency', currency }).format(amount / currencyScale(currency))
