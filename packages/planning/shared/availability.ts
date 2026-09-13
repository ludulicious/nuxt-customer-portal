import type { AvailabilityWindow, Interval, Slot } from './types'

const minute = 60000
const formatters = new Map<string, Intl.DateTimeFormat>()
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
  noticeMinutes: number
  horizonDays: number
  productId: string
  providerUserId: string
  providerName: string
  windows: AvailabilityWindow[]
  busy: Interval[]
}): Slot[] {
  const slots: Slot[] = []
  const busy = input.busy.map((b) => ({ start: Date.parse(b.start), end: Date.parse(b.end) }))
  const lower = Math.max(input.from.getTime(), input.now.getTime() + input.noticeMinutes * minute)
  const upper = Math.min(input.to.getTime(), input.now.getTime() + input.horizonDays * 86400000)
  for (let start = Math.ceil(lower / minute) * minute; start < upper; start += minute) {
    const end = start + input.durationMinutes * minute
    if (end > upper) {
      break
    }
    const fits = input.windows.some((w) => {
      if (w.productIds && !w.productIds.includes(input.productId)) {
        return false
      }
      const first = localParts(new Date(start), w.timezone),
        last = localParts(new Date(end), w.timezone)
      const endsAtMidnight =
        w.endTime === '24:00' && last.time === '00:00' && Date.parse(last.date) === Date.parse(first.date) + 86400000
      if (
        (first.date !== last.date && !endsAtMidnight) ||
        first.date < w.date ||
        (w.endDate && first.date > w.endDate) ||
        w.exceptions.includes(first.date)
      ) {
        return false
      }
      if (w.recurring ? new Date(first.date).getUTCDay() !== new Date(w.date).getUTCDay() : first.date !== w.date) {
        return false
      }
      const wallMinute = (s: string) => Number(s.slice(0, 2)) * 60 + Number(s.slice(3))
      return (
        first.time >= w.startTime &&
        (endsAtMidnight || last.time <= w.endTime) &&
        (wallMinute(first.time) - wallMinute(w.startTime)) % input.intervalMinutes === 0
      )
    })
    if (!fits || busy.some((b) => start < b.end && end + input.graceMinutes * minute > b.start)) {
      continue
    }
    slots.push({
      start: new Date(start).toISOString(),
      end: new Date(end).toISOString(),
      providerUserId: input.providerUserId,
      providerName: input.providerName
    })
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
