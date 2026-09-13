import assert from 'node:assert/strict'
import test from 'node:test'
import { formatAppointmentRange, formatAppointmentTime } from '../shared/appointment-time'

test('appointment times respect locale hour preferences and local midnight', () => {
  const options = { locale: 'en-US', timeZone: 'Europe/Amsterdam', midnight: 'midnight' }
  assert.equal(formatAppointmentTime('2026-09-29T22:00:00Z', options), 'midnight')
  assert.match(formatAppointmentTime('2026-09-29T20:30:00Z', options), /10:30.*PM/)
  assert.equal(formatAppointmentTime('2026-09-29T20:30:00Z', { ...options, locale: 'nl-NL' }), '22:30')
  assert.match(formatAppointmentRange('2026-09-29T20:30:00Z', '2026-09-29T22:00:00Z', options), /– midnight$/)
  assert.doesNotMatch(formatAppointmentRange('2026-09-29T20:30:00Z', '2026-09-29T22:00:00Z', options), /September 30/)
  assert.match(
    formatAppointmentRange('2026-09-29T20:30:00Z', '2026-09-29T22:00:00Z', { ...options, includeDate: false }),
    /^10:30.*PM – midnight$/
  )
  assert.equal(
    formatAppointmentRange('2026-09-29T20:30:00Z', '2026-09-29T21:30:00Z', {
      ...options,
      locale: 'nl-NL',
      includeDate: false
    }),
    '22:30 – 23:30'
  )
})
