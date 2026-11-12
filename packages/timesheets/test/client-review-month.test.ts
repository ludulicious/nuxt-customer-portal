import assert from 'node:assert/strict'
import test from 'node:test'
import { reviewPeriodIncludesMonth, shiftReviewMonth } from '../shared/client-review-month'

test('monthly request views include the work month and exclude neighboring months', () => {
  const period = { startsOn: '2026-11-02', endsOn: '2026-11-08' }
  assert.equal(reviewPeriodIncludesMonth(period, '2026-11'), true)
  assert.equal(reviewPeriodIncludesMonth(period, '2026-10'), false)
  assert.equal(reviewPeriodIncludesMonth(period, '2026-12'), false)
})

test('requests spanning a month or year boundary appear in each affected work month', () => {
  const period = { startsOn: '2026-12-28', endsOn: '2027-01-03' }
  assert.equal(reviewPeriodIncludesMonth(period, '2026-12'), true)
  assert.equal(reviewPeriodIncludesMonth(period, '2027-01'), true)
  assert.equal(reviewPeriodIncludesMonth(period, '2026-11'), false)
  assert.equal(reviewPeriodIncludesMonth(period, '2027-02'), false)
})

test('previous and next month navigation crosses year boundaries', () => {
  assert.equal(shiftReviewMonth('2026-12', 1), '2027-01')
  assert.equal(shiftReviewMonth('2027-01', -1), '2026-12')
  assert.equal(shiftReviewMonth('2028-02', 1), '2028-03')
  assert.equal(shiftReviewMonth('2028-03', -1), '2028-02')
})
