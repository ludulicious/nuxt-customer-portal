import type { AvailabilityWindow, Interval } from './types'
import { calendarWallDateTime, localParts, wallInstant } from './availability'

function occurrenceInstant(date: string, time: string, timezone: string) {
  const wall = calendarWallDateTime(date, time)
  return wallInstant(wall.slice(0, 10), wall.slice(11, 16), timezone).getTime()
}

export function availabilityCalendarOverrides(window: AvailabilityWindow, busy: Interval[]) {
  const dates = new Set<string>()
  for (const interval of busy) {
    const first = localParts(new Date(interval.start), window.timezone).date
    const last = localParts(new Date(Date.parse(interval.end) - 1), window.timezone).date
    for (let date = first; date <= last;) {
      if (
        date >= window.date &&
        (!window.endDate || date <= window.endDate) &&
        !window.exceptions.includes(date) &&
        (window.recurring ? new Date(date).getUTCDay() === new Date(window.date).getUTCDay() : date === window.date)
      ) {
        dates.add(date)
      }
      date = new Date(Date.parse(date) + 86400000).toISOString().slice(0, 10)
    }
  }
  const overrides: Array<{ date: string; segments: Interval[] }> = []
  const blocks = busy
    .map((interval) => ({ start: Date.parse(interval.start), end: Date.parse(interval.end) }))
    .sort((first, second) => first.start - second.start)
  for (const date of [...dates].sort()) {
    const start = occurrenceInstant(date, window.startTime, window.timezone)
    const end = occurrenceInstant(date, window.endTime, window.timezone)
    const overlapping = blocks.filter((block) => block.start < end && block.end > start)
    if (!overlapping.length) {
      continue
    }
    const segments: Interval[] = []
    let cursor = start
    for (const block of overlapping) {
      if (block.start > cursor) {
        segments.push({ start: new Date(cursor).toISOString(), end: new Date(block.start).toISOString() })
      }
      cursor = Math.max(cursor, block.end)
    }
    if (cursor < end) {
      segments.push({ start: new Date(cursor).toISOString(), end: new Date(end).toISOString() })
    }
    overrides.push({ date, segments })
  }
  return overrides
}
