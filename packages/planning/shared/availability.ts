import type { AvailabilityWindow, Interval, Slot } from './types'

const minute = 60000
const formatters = new Map<string, Intl.DateTimeFormat>()
/** Keep display spacing anchored to local midnight, not the first remaining available slot. */
export function isDisplaySlot(slot: Slot, timezone: string, maximumInterval = 30): boolean {
  const interval = Math.min((Date.parse(slot.end) - Date.parse(slot.start)) / minute, maximumInterval)
  const { time } = localParts(new Date(slot.start), timezone)
  const wallMinutes = Number(time.slice(0, 2)) * 60 + Number(time.slice(3))
  return interval > 0 && wallMinutes % interval === 0
}
export function localParts(instant: Date, timezone: string) {
  let formatter = formatters.get(timezone)
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23'
    })
    formatters.set(timezone, formatter)
  }
  const parts = formatter.formatToParts(instant)
  const get = (key: string) => parts.find((p) => p.type === key)!.value
  return { date: `${get('year')}-${get('month')}-${get('day')}`, time: `${get('hour')}:${get('minute')}` }
}
/** UTC iteration handles skipped/repeated wall-clock times without fixed offsets. */
export function generateSlots(input: {
  from: Date
  to: Date
  now: Date
  durationMinutes: number
  graceMinutes: number
  intervalMinutes: number
  displayIntervalMinutes?: number
  noticeMinutes: number
  horizonDays: number
  productId: string
  providerUserId: string
  providerName: string
  windows: AvailabilityWindow[]
  busy: Interval[]
}): Slot[] {
  const slots: Slot[] = []
  const busy: Array<{ start: number; end: number }> = []
  for (const period of input.busy
    .map((period) => ({ start: Date.parse(period.start), end: Date.parse(period.end) }))
    .filter((period) => period.end > period.start)
    .sort((first, second) => first.start - second.start)) {
    const previous = busy.at(-1)
    if (previous && period.start <= previous.end) {
      previous.end = Math.max(previous.end, period.end)
    } else {
      busy.push(period)
    }
  }
  const groups = new Map<
    string,
    {
      windows: Array<{ window: AvailabilityWindow; index: number; weekday: number; startMinute: number }>
      date: string
      active: Array<{ window: AvailabilityWindow; index: number; weekday: number; startMinute: number }>
    }
  >()
  const wallMinute = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3))
  input.windows.forEach((window, index) => {
    if (window.productIds && !window.productIds.includes(input.productId)) {
      return
    }
    let group = groups.get(window.timezone)
    if (!group) {
      group = { windows: [], date: '', active: [] }
      groups.set(window.timezone, group)
    }
    group.windows.push({
      window,
      index,
      weekday: new Date(window.date).getUTCDay(),
      startMinute: wallMinute(window.startTime)
    })
  })
  if (!groups.size) {
    return slots
  }
  const lower = Math.max(input.from.getTime(), input.now.getTime() + input.noticeMinutes * minute)
  const upper = Math.min(input.to.getTime(), input.now.getTime() + input.horizonDays * 86400000)
  let busyIndex = 0
  for (let start = Math.ceil(lower / minute) * minute; start < upper; start += minute) {
    const end = start + input.durationMinutes * minute
    if (end > upper) {
      break
    }
    while (busy[busyIndex] && busy[busyIndex]!.end <= start) {
      busyIndex++
    }
    const conflict = busy[busyIndex]
    if (conflict && start < conflict.end && end + input.graceMinutes * minute > conflict.start) {
      start = Math.ceil(conflict.end / minute) * minute - minute
      continue
    }
    let matchingIndex = Infinity
    let matchingTime = ''
    for (const [timezone, group] of groups) {
      const first = localParts(new Date(start), timezone)
      if (group.date !== first.date) {
        group.date = first.date
        const weekday = new Date(first.date).getUTCDay()
        group.active = group.windows.filter(
          ({ window, weekday: windowWeekday }) =>
            first.date >= window.date &&
            (!window.endDate || first.date <= window.endDate) &&
            !window.exceptions.includes(first.date) &&
            (window.recurring ? weekday === windowWeekday : first.date === window.date)
        )
      }
      let last: ReturnType<typeof localParts> | undefined
      for (const { window, index, startMinute } of group.active) {
        if (index >= matchingIndex) {
          break
        }
        if (first.time < window.startTime || (wallMinute(first.time) - startMinute) % input.intervalMinutes !== 0) {
          continue
        }
        last ??= localParts(new Date(end), timezone)
        const endsAtMidnight =
          window.endTime === '24:00' &&
          last.time === '00:00' &&
          Date.parse(last.date) === Date.parse(first.date) + 86400000
        if ((first.date !== last.date && !endsAtMidnight) || (!endsAtMidnight && last.time > window.endTime)) {
          continue
        }
        matchingIndex = index
        matchingTime = first.time
        break
      }
    }
    if (matchingIndex === Infinity) {
      continue
    }
    const slot = {
      start: new Date(start).toISOString(),
      end: new Date(end).toISOString(),
      providerUserId: input.providerUserId,
      providerName: input.providerName
    }
    const displayInterval = Math.min(input.durationMinutes, input.displayIntervalMinutes || input.durationMinutes)
    if (input.displayIntervalMinutes && !(displayInterval > 0 && wallMinute(matchingTime) % displayInterval === 0)) {
      continue
    }
    slots.push(slot)
  }
  return slots
}
export const canChange = (start: Date, now: Date, cutoffMinutes: number) =>
  start.getTime() - now.getTime() >= cutoffMinutes * minute && start > now
export function changeFee(changes: number, freeChanges: number, fees: Record<string, number>, currency: string) {
  if (changes < freeChanges) {
    return 0
  }
  const fee = fees[currency]
  if (!fee) {
    throw new Error('No change fee configured for this currency')
  }
  return fee
}
export const refundAmount = (paid: number, alreadyRefunded: number, percentage: number) =>
  Math.max(0, Math.min(paid - alreadyRefunded, Math.round((paid * percentage) / 100)))

/** Format a local wall time for calendar APIs, which require midnight as the following day's 00:00. */
export function calendarWallDateTime(date: string, time: string) {
  if (time !== '24:00') {
    return `${date}T${time}:00`
  }
  const nextDate = new Date(`${date}T00:00:00Z`)
  nextDate.setUTCDate(nextDate.getUTCDate() + 1)
  return `${nextDate.toISOString().slice(0, 10)}T00:00:00`
}

/** Resolve explicit local wall time; reject nonexistent times instead of silently changing them. */
export function wallInstant(date: string, time: string, timezone: string): Date {
  const target = Date.parse(`${date}T${time}:00Z`)
  let guess = target
  for (let i = 0; i < 6; i++) {
    const parts = localParts(new Date(guess), timezone)
    const delta = target - Date.parse(`${parts.date}T${parts.time}:00Z`)
    if (!delta) {
      return new Date(guess)
    }
    guess += delta
  }
  throw new Error('This local time does not exist in the selected timezone')
}
