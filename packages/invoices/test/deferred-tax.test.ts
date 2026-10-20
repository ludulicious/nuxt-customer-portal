import assert from 'node:assert/strict'
import test from 'node:test'
import { splitInclusiveTax } from '../server/utils/deferred-tax'

test('inclusive invoice tax preserves the agreed amount including zero rates and rounding', () => {
  assert.deepEqual(splitInclusiveTax(1210, 2100), { net: 1000, tax: 210, total: 1210 })
  assert.deepEqual(splitInclusiveTax(1210, 0), { net: 1210, tax: 0, total: 1210 })
  for (const amount of [0, 1, 99, 1000, 100000000]) {
    for (const rate of [0, 900, 2100, 10000]) {
      const split = splitInclusiveTax(amount, rate)
      assert.equal(split.net + split.tax, amount)
      assert.ok(split.net >= 0 && split.tax >= 0)
    }
  }
  assert.throws(() => splitInclusiveTax(-1, 2100))
  assert.throws(() => splitInclusiveTax(100, 10001))
})
