import assert from 'node:assert/strict'
import test from 'node:test'
import { clientReviewPeriods, nextReviewMonth } from '../shared/client-review-periods'
import { addIsoDays } from '../shared/timesheet-dates'

test('monthly periods include leap days and year rollover', () => {
  assert.deepEqual(clientReviewPeriods('2028-02', 'MONTHLY'), [{ startsOn: '2028-02-01', endsOn: '2028-02-29' }])
  assert.equal(nextReviewMonth('2026-12-20'), '2027-01-01')
})
test('two-week periods pair clipped calendar weeks from the first of the month', () => {
  assert.deepEqual(clientReviewPeriods('2026-10', 'TWO_WEEKLY'), [
    { startsOn: '2026-10-01', endsOn: '2026-10-11' },
    { startsOn: '2026-10-12', endsOn: '2026-10-25' },
    { startsOn: '2026-10-26', endsOn: '2026-10-31' }
  ])
})
test('all intervals and week starts cover each day exactly once across two years', () => {
  for (const year of [2027, 2028]) {
    for (let month = 1; month <= 12; month++) {
      const first = `${year}-${String(month).padStart(2, '0')}-01`
      const next = nextReviewMonth(first)
      for (const interval of ['WEEKLY', 'TWO_WEEKLY', 'MONTHLY'] as const) {
        for (let weekStart = 0; weekStart < 7; weekStart++) {
          const periods = clientReviewPeriods(first, interval, weekStart)
          let cursor = first
          for (const period of periods) {
            assert.equal(period.startsOn, cursor)
            assert.ok(period.endsOn >= period.startsOn && period.endsOn < next)
            cursor = addIsoDays(period.endsOn, 1)
          }
          assert.equal(cursor, next)
        }
      }
    }
  }
})
test('a Sunday workspace clips its boundary independently of Monday workspaces', () => {
  assert.deepEqual(clientReviewPeriods('2026-11', 'WEEKLY', 0)[0], { startsOn: '2026-11-01', endsOn: '2026-11-07' })
  assert.deepEqual(clientReviewPeriods('2026-11', 'WEEKLY', 1)[0], { startsOn: '2026-11-01', endsOn: '2026-11-01' })
})
