import assert from 'node:assert/strict'
import test from 'node:test'
import {
  reviewPeriodIncludesMonth,
  shiftReviewMonth,
  showReviewPeriod,
  reviewClientOptions
} from '../shared/client-review-month'

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

test('showing empty periods only includes active tracked clients and never hides recorded work', () => {
  for (const timeTrackingEnabled of [true, false]) {
    assert.equal(showReviewPeriod({ timeTrackingEnabled, availableCount: 0, outstandingCount: 0 }, false), false)
    assert.equal(
      showReviewPeriod({ timeTrackingEnabled, availableCount: 0, outstandingCount: 0 }, true),
      timeTrackingEnabled
    )
    for (const showEmpty of [true, false]) {
      assert.equal(showReviewPeriod({ timeTrackingEnabled, availableCount: 1, outstandingCount: 0 }, showEmpty), true)
      assert.equal(showReviewPeriod({ timeTrackingEnabled, availableCount: 0, outstandingCount: 1 }, showEmpty), true)
    }
  }
})

test('client filter combines tracked periods with monthly requests without duplicates', () => {
  assert.deepEqual(
    reviewClientOptions(
      [
        { workspaceClientId: 'tracked', clientName: 'Zulu' },
        { workspaceClientId: 'tracked', clientName: 'Zulu' },
        { workspaceClientId: 'recorded', clientName: 'Beta' }
      ],
      [
        { workspaceClientId: 'recorded', clientName: 'Beta' },
        { workspaceClientId: 'earlier', clientName: 'Alpha' }
      ]
    ),
    [
      { value: 'earlier', label: 'Alpha' },
      { value: 'recorded', label: 'Beta' },
      { value: 'tracked', label: 'Zulu' }
    ]
  )
})
