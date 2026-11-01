import assert from 'node:assert/strict'
import test from 'node:test'
import { generateSlots } from '../shared/availability'
import { createAvailabilityLoader } from '../shared/availability-loader'
import type { AvailabilityWindow, Slot } from '../shared/types'

const window: AvailabilityWindow = {
  id: 'window',
  userId: 'host',
  timezone: 'Europe/Amsterdam',
  date: '2026-11-02',
  endDate: null,
  startTime: '09:00',
  endTime: '12:00',
  recurring: true,
  productIds: null,
  exceptions: []
}
const input = {
  from: new Date('2026-11-02T00:00:00Z'),
  to: new Date('2026-11-03T00:00:00Z'),
  now: new Date('2026-11-01T00:00:00Z'),
  durationMinutes: 30,
  graceMinutes: 0,
  intervalMinutes: 15,
  noticeMinutes: 0,
  horizonDays: 90,
  productId: 'product',
  providerUserId: 'host',
  providerName: 'Host',
  windows: [window],
  busy: []
}

test('historical windows do not multiply timezone work for each minute of the month', () => {
  const historical = Array.from({ length: 100 }, (_, index) => ({
    ...window,
    id: `old-${index}`,
    date: '2025-01-01',
    recurring: false
  }))
  const expected = generateSlots(input)
  const formatToParts = Intl.DateTimeFormat.prototype.formatToParts
  let calls = 0
  Intl.DateTimeFormat.prototype.formatToParts = function (...args) {
    calls++
    return formatToParts.apply(this, args)
  }
  try {
    assert.deepEqual(generateSlots({ ...input, windows: [...historical, window] }), expected)
    assert.ok(calls < 1600, `Expected timezone work independent of window count, got ${calls}`)
  } finally {
    Intl.DateTimeFormat.prototype.formatToParts = formatToParts
  }
})

test('merged unsorted busy periods preserve grace, half-open boundaries and seconds', () => {
  const busy = [
    { start: '2026-11-02T09:00:00Z', end: '2026-11-02T09:30:01Z' },
    { start: '2026-11-02T08:45:00Z', end: '2026-11-02T09:15:00Z' },
    { start: '2026-11-02T08:30:00Z', end: '2026-11-02T08:45:00Z' }
  ]
  const result = generateSlots({ ...input, busy, graceMinutes: 5 })
  assert.deepEqual(
    result.map((slot) => slot.start),
    ['2026-11-02T09:45:00.000Z', '2026-11-02T10:00:00.000Z', '2026-11-02T10:15:00.000Z', '2026-11-02T10:30:00.000Z']
  )
  assert.ok(generateSlots({ ...input, busy }).some((slot) => slot.start === '2026-11-02T08:00:00.000Z'))
})

test('overlapping windows retain original timezone precedence for display spacing', () => {
  const first = { ...window, timezone: 'Asia/Kathmandu', startTime: '00:00', endTime: '24:00' }
  const second = { ...first, timezone: 'UTC' }
  const result = generateSlots({
    ...input,
    to: new Date('2026-11-02T03:00:00Z'),
    durationMinutes: 30,
    displayIntervalMinutes: 30,
    windows: [first, second]
  })
  assert.ok(result.length)
  assert.ok(result.every((slot) => new Date(slot.start).getUTCMinutes() % 30 === 15))
  const reversed = generateSlots({
    ...input,
    to: new Date('2026-11-02T03:00:00Z'),
    durationMinutes: 30,
    displayIntervalMinutes: 30,
    windows: [second, first]
  })
  assert.ok(reversed.every((slot) => new Date(slot.start).getUTCMinutes() % 30 === 0))
})

test('day index respects occurrence exceptions, midnight and recurring end dates', () => {
  const values = generateSlots({
    ...input,
    from: new Date('2026-11-01T00:00:00Z'),
    to: new Date('2026-11-25T00:00:00Z'),
    windows: [{ ...window, startTime: '23:00', endTime: '24:00', endDate: '2026-11-16', exceptions: ['2026-11-09'] }]
  })
  assert.deepEqual([...new Set(values.map((slot) => slot.start.slice(0, 10)))], ['2026-11-02', '2026-11-16'])
  assert.equal(values.at(-1)?.end, '2026-11-16T23:00:00.000Z')
})

const slot: Slot = {
  start: '2026-11-02T09:00:00Z',
  end: '2026-11-02T09:30:00Z',
  providerUserId: 'host',
  providerName: 'Host'
}

test('month loader reuses recent months, deduplicates pending requests, and expires after 30 seconds', async () => {
  let now = 0
  const calls: string[] = []
  const load = createAvailabilityLoader(
    async (key) => {
      calls.push(key)
      return [slot]
    },
    () => now
  )
  await Promise.all([load('november'), load('november')])
  await load('december')
  await load('november')
  assert.deepEqual(calls, ['november', 'december'])
  now = 30000
  await load('november')
  assert.equal(calls.length, 3)
})

test('month loader forces a fresh check after a reservation conflict and does not cache failures', async () => {
  let calls = 0
  const load = createAvailabilityLoader(async () => {
    calls++
    if (calls === 2) {
      throw new Error('Calendar unavailable')
    }
    return calls === 1 ? [slot] : []
  })
  assert.deepEqual(await load('month'), [slot])
  await assert.rejects(load('month', true))
  assert.deepEqual(await load('month'), [])
  assert.equal(calls, 3)
})

test('month caches are per picker, bounded to four months and keyed by product and appointment', async () => {
  const calls: string[] = []
  const load = createAvailabilityLoader(async (key) => {
    calls.push(key)
    return []
  })
  const anotherPicker = createAvailabilityLoader(async (key) => {
    calls.push(key)
    return []
  })
  for (const key of ['product-a:nov', 'product-b:nov', 'appointment:nov', 'product-a:dec', 'product-a:jan']) {
    await load(key)
  }
  await load('product-a:nov')
  await anotherPicker('product-a:nov')
  assert.equal(calls.length, 7)
})
