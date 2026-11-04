import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

test('product details link the displayed slug to the encoded public store route', () => {
  const card = readFileSync(new URL('../app/components/ProductsDetailsCard.vue', import.meta.url), 'utf8')
  assert.match(card, /<NuxtLink\s+:to="`\/store\/\$\{encodeURIComponent\(product\.slug\)\}`"/)
  assert.match(card, /hover:underline focus-visible:underline/)
  assert.match(card, />\/\{\{ product\.slug \}\}<\/NuxtLink/)
})
