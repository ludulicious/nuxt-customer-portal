import assert from 'node:assert/strict'
import test from 'node:test'
import { availabilityCalendarOverrides } from '../shared/availability-calendar'
import type { AvailabilityWindow } from '../shared/types'

const window: AvailabilityWindow = {
  id: 'window',
  userId: 'provider',
  date: '2026-10-26',
  endDate: null,
  startTime: '09:00',
  endTime: '17:00',
  timezone: 'UTC',
  recurring: true,
  productIds: null,
  exceptions: []
}
const interval = (start: string, end: string) => ({ start: start + ':00.000Z', end: end + ':00.000Z' })

test('availability splits around bookings and their supplied grace time, merging overlapping blocks', () => {
  assert.deepEqual(
    availabilityCalendarOverrides(window, [
      interval('2026-10-26T10:00', '2026-10-26T11:15'),
      interval('2026-10-26T10:30', '2026-10-26T12:00'),
      interval('2026-10-26T14:00', '2026-10-26T15:15')
    ]),
    [
      {
        date: '2026-10-26',
        segments: [
          interval('2026-10-26T09:00', '2026-10-26T10:00'),
          interval('2026-10-26T12:00', '2026-10-26T14:00'),
          interval('2026-10-26T15:15', '2026-10-26T17:00')
        ]
      }
    ]
  )
})

test('fully booked windows disappear; adjacent bookings do not create empty pieces', () => {
  assert.deepEqual(
    availabilityCalendarOverrides(window, [
      interval('2026-10-26T08:00', '2026-10-26T12:00'),
      interval('2026-10-26T12:00', '2026-10-26T18:00')
    ]),
    [{ date: '2026-10-26', segments: [] }]
  )
  assert.deepEqual(
    availabilityCalendarOverrides(window, [
      interval('2026-10-26T08:00', '2026-10-26T09:00'),
      interval('2026-10-26T17:00', '2026-10-26T18:00')
    ]),
    []
  )
})

test('recurrence boundaries and explicit exceptions are preserved', () => {
  const busy = ['2026-10-19', '2026-10-26', '2026-10-27', '2026-11-02', '2026-11-09', '2026-11-16'].map((date) =>
    interval(date + 'T10:00', date + 'T11:00')
  )
  assert.deepEqual(
    availabilityCalendarOverrides({ ...window, endDate: '2026-11-09', exceptions: ['2026-11-02'] }, busy).map(
      (override) => override.date
    ),
    ['2026-10-26', '2026-11-09']
  )
  assert.deepEqual(
    availabilityCalendarOverrides({ ...window, recurring: false }, busy).map((override) => override.date),
    ['2026-10-26']
  )
})

test('moving and cancelling appointments restores their previous availability', () => {
  const original = availabilityCalendarOverrides(window, [interval('2026-10-26T10:00', '2026-10-26T11:00')])
  const moved = availabilityCalendarOverrides(window, [interval('2026-11-02T12:00', '2026-11-02T13:00')])
  assert.equal(original[0]!.date, '2026-10-26')
  assert.equal(moved[0]!.date, '2026-11-02')
  assert.deepEqual(availabilityCalendarOverrides(window, []), [])
})

test('DST and 24:00 boundaries use real instants in the window timezone', () => {
  assert.deepEqual(
    availabilityCalendarOverrides(
      {
        ...window,
        date: '2026-10-25',
        recurring: false,
        timezone: 'Europe/Amsterdam',
        startTime: '01:00',
        endTime: '04:00'
      },
      [interval('2026-10-25T00:30', '2026-10-25T01:30')]
    ),
    [
      {
        date: '2026-10-25',
        segments: [interval('2026-10-24T23:00', '2026-10-25T00:30'), interval('2026-10-25T01:30', '2026-10-25T03:00')]
      }
    ]
  )
  assert.deepEqual(
    availabilityCalendarOverrides({ ...window, startTime: '22:00', endTime: '24:00' }, [
      interval('2026-10-26T23:00', '2026-10-27T00:15')
    ]),
    [{ date: '2026-10-26', segments: [interval('2026-10-26T22:00', '2026-10-26T23:00')] }]
  )
})

test('a block spanning local midnight adjusts every affected occurrence', () => {
  assert.deepEqual(
    availabilityCalendarOverrides({ ...window, startTime: '00:00', endTime: '03:00' }, [
      interval('2026-10-25T23:30', '2026-10-26T01:15')
    ]),
    [{ date: '2026-10-26', segments: [interval('2026-10-26T01:15', '2026-10-26T03:00')] }]
  )
})
