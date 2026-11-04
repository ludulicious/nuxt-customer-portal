import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { resolveCheckoutReturnUrl, resolveProductReturnUrl } from '../shared/checkout-query'

test('product details link the displayed slug to the encoded public store route', () => {
  const card = readFileSync(new URL('../app/components/ProductsDetailsCard.vue', import.meta.url), 'utf8')
  assert.match(card, /path: `\/store\/\$\{encodeURIComponent\(product\.slug\)\}`, query: \{ returnUrl \}/)
  assert.match(card, /new URL\(route.fullPath, portalOrigin\).href/)
  assert.match(card, /hover:underline focus-visible:underline/)
  assert.match(card, />\/\{\{ product\.slug \}\}<\/NuxtLink/)
})

test('store return links preserve the exact same-portal product URL, including query and fragment', () => {
  const origin = 'https://saas.izzi.nl'
  const target = `${origin}/admin/products/2ce56341-1a45-4190-a5d2-a950cc970f64?scroll=42#offers`
  assert.equal(resolveProductReturnUrl(target, origin), target)
  assert.equal(resolveCheckoutReturnUrl(target, '', origin), target)
  assert.equal(resolveCheckoutReturnUrl(target, 'https://store.example/services', origin), target)
  for (const candidate of [
    'https://attacker.example/admin/products/product',
    `${origin}/admin/products/product/edit`,
    `${origin}/admin/settings`,
    'https://user:password@saas.izzi.nl/admin/products/product',
    '//attacker.example/admin/products/product',
    'javascript:alert(1)',
    [target],
    undefined
  ]) {
    assert.equal(resolveProductReturnUrl(candidate, origin), undefined)
    assert.equal(
      resolveCheckoutReturnUrl(candidate, 'https://store.example/services', origin),
      'https://store.example/services'
    )
  }
})

test('store page uses the product return label only for validated product URLs', () => {
  const page = readFileSync(new URL('../app/pages/store/[slug].vue', import.meta.url), 'utf8')
  assert.match(page, /resolveProductReturnUrl\(checkoutReturnUrl.value, portalOrigin\)/)
  assert.match(page, /productReturnUrl \? 'products.backToProduct' : 'products.backToOffering'/)
  assert.match(page, /:href="checkoutReturnUrl"/)
})
