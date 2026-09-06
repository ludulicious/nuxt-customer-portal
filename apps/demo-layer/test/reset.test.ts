import assert from 'node:assert/strict'
import { test } from 'node:test'
import { demoDay, nextDemoReset } from '../server/utils/demo-data'

test('midnight is calculated in Amsterdam across daylight saving changes', () => {
  for (const [input, expected] of [
    ['2026-09-06T08:00:00Z', '2026-09-06T22:00:00.000Z'],
    ['2026-03-28T23:00:00Z', '2026-03-29T22:00:00.000Z'],
    ['2026-10-24T22:00:00Z', '2026-10-25T23:00:00.000Z']
  ]) {
    assert.equal(nextDemoReset(new Date(input!)).toISOString(), expected)
  }
  assert.equal(demoDay(new Date('2026-09-06T22:00:00Z')), '2026-09-07')
})
