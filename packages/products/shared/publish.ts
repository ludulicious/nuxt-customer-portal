import type { ProductData, Locale } from './types'

export function publishChecks(
  product: ProductData & { prices: { currency: string; amount: number }[] },
  settings: { languages: Locale[]; currencies: string[]; enabled: boolean }
) {
  return [
    ...settings.languages.map((language) => ({
      key: 'publishText',
      value: language,
      passed: ['title', 'summary', 'description'].every((field) =>
        product.content[language][field as 'title' | 'summary' | 'description'].trim()
      ),
      warning: false
    })),
    { key: 'publishImage', value: '', passed: product.imageIds.length > 0, warning: false },
    ...(product.isFree
      ? [{ key: 'publishFree', value: '', passed: true, warning: false }]
      : settings.currencies.map((currency) => ({
          key: 'publishPrice',
          value: currency,
          passed: product.prices.some((price) => price.currency === currency && price.amount > 0),
          warning: false
        }))),
    ...(product.type === 'digital'
      ? [{ key: 'publishFile', value: '', passed: product.fileIds.length > 0, warning: false }]
      : []),
    { key: 'publishStoreOpen', value: '', passed: settings.enabled, warning: true }
  ]
}
