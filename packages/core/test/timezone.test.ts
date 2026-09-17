import assert from 'node:assert/strict'
import test from 'node:test'
import { isValidTimezone, resolveTimezones } from '../shared/timezone'

test('timezone identifiers include daylight-saving zones and reject offsets and unknown zones', () => {
  for (const zone of ['Europe/Amsterdam', 'America/New_York', 'UTC', 'Asia/Kolkata']) {
    assert.equal(isValidTimezone(zone), true)
  }
  for (const zone of ['', '+02:00', 'Amsterdam', 'Europe/Unknown']) {
    assert.equal(isValidTimezone(zone), false)
  }
})
test('display and scheduling timezones have independent inheritance', () => {
  assert.equal(resolveTimezones({ providerTimezone: 'Europe/Amsterdam' }).displayTimezone, 'Europe/Amsterdam')
  const resolved = resolveTimezones({
    providerTimezone: 'Europe/Amsterdam',
    clientTimezone: 'Asia/Tokyo',
    userTimezone: 'America/New_York'
  })
  assert.equal(resolved.schedulingTimezone, 'Asia/Tokyo')
  assert.equal(resolved.displayTimezone, 'America/New_York')
  assert.equal(
    resolveTimezones({ providerTimezone: 'UTC', clientTimezone: 'Asia/Tokyo', userTimezone: null }).displayTimezone,
    'Asia/Tokyo'
  )
})
test('displaying an appointment across DST changes preserves its instant', () => {
  const format = (value: string, zone: string) =>
    new Intl.DateTimeFormat('en-GB', { timeZone: zone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(
      new Date(value)
    )
  assert.equal(format('2026-03-29T00:30:00Z', 'Europe/Amsterdam'), '01:30')
  assert.equal(format('2026-03-29T01:30:00Z', 'Europe/Amsterdam'), '03:30')
  assert.equal(format('2026-03-29T01:30:00Z', 'UTC'), '01:30')
  assert.equal(format('2026-10-25T00:30:00Z', 'Europe/Amsterdam'), '02:30')
  assert.equal(format('2026-10-25T01:30:00Z', 'Europe/Amsterdam'), '02:30')
})
