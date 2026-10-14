import { addIsoDays } from './timesheet-dates'

export type ClientReviewInterval = 'WEEKLY' | 'TWO_WEEKLY' | 'MONTHLY'
export interface ClientReviewPeriod {
  startsOn: string
  endsOn: string
}

export const nextReviewMonth = (today: string) => {
  const date = new Date(`${today.slice(0, 7)}-01T12:00:00Z`)
  date.setUTCMonth(date.getUTCMonth() + 1)
  return date.toISOString().slice(0, 10)
}

export const clientReviewPeriods = (
  month: string,
  interval: ClientReviewInterval,
  weekStartsOn = 1
): ClientReviewPeriod[] => {
  const start = `${month.slice(0, 7)}-01`
  const end = addIsoDays(nextReviewMonth(start), -1)
  if (interval === 'MONTHLY') {
    return [{ startsOn: start, endsOn: end }]
  }
  const segments: ClientReviewPeriod[] = []
  let cursor = start
  while (cursor <= end) {
    const weekday = new Date(`${cursor}T12:00:00Z`).getUTCDay()
    const last = addIsoDays(cursor, (weekStartsOn + 6 - weekday + 7) % 7)
    segments.push({ startsOn: cursor, endsOn: last < end ? last : end })
    cursor = addIsoDays(segments.at(-1)!.endsOn, 1)
  }
  if (interval === 'WEEKLY') {
    return segments
  }
  return segments
    .filter((_, index) => index % 2 === 0)
    .map((segment, index) => ({
      startsOn: segment.startsOn,
      endsOn: (segments[index * 2 + 1] ?? segment).endsOn
    }))
}
