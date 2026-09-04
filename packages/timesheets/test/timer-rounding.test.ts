import assert from 'node:assert/strict'
import test from 'node:test'
import { roundTimerMinutes } from '../shared/timer-rounding'
import { settingsUpdateSchema } from '../server/utils/timesheet-validation'

test('timers round upward, preserving exact interval boundaries', () => {
  assert.equal(roundTimerMinutes(16 * 60_000, 15), 30)
  assert.equal(roundTimerMinutes(15 * 60_000, 15), 15)
  assert.equal(roundTimerMinutes(15 * 60_000 + 1, 15), 30)
  assert.equal(roundTimerMinutes(1, 5), 5)
  assert.equal(roundTimerMinutes(60_001, 1), 2)
  assert.equal(roundTimerMinutes(0, 1), 1)
})
test('workspace rounding accepts whole minutes from 1 to 60', () => {
  for (const value of [0, -1, 61, 1.5]) {
    assert.equal(settingsUpdateSchema.safeParse({ timerRoundingMinutes: value }).success, false)
  }
  for (const value of [1, 5, 15, 60]) {
    assert.equal(settingsUpdateSchema.safeParse({ timerRoundingMinutes: value }).success, true)
  }
})
