import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'

for (const locale of ['en', 'nl']) {
  test(`${locale} checkout confirmation applies to free orders without claiming payment`, async () => {
    const { products: copy } = JSON.parse(
      await readFile(new URL(`../i18n/locales/${locale}.json`, import.meta.url), 'utf8')
    )
    for (const key of ['paymentStatusSuccess', 'paymentReturnTitleSuccess', 'paymentReturnSuccess']) {
      assert.ok(copy[key])
      assert.doesNotMatch(copy[key], /payment|paid|betaling|betaald/i)
      assert.match(copy[key], /order|bestelling/i)
    }
    assert.match(copy.invoicePaymentHelp, /invoice|factuur/i)
  })
}
