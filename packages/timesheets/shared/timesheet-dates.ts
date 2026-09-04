export const mondayFor = (dateString?: string) => {
  const date = dateString ? new Date(`${dateString}T12:00:00Z`) : new Date()
  const day = date.getUTCDay()
  const offset = day === 0 ? -6 : 1 - day
  date.setUTCDate(date.getUTCDate() + offset)
  return date.toISOString().slice(0, 10)
}

export const addIsoDays = (dateString: string, days: number) => {
  const date = new Date(`${dateString}T12:00:00Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

/** Format a calendar-date period identically in the UI and server-rendered emails. */
export const formatTimesheetPeriod = (from: string, to: string, locale: string) =>
  new Intl.DateTimeFormat(locale, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC'
  }).formatRange(new Date(`${from}T12:00:00Z`), new Date(`${to}T12:00:00Z`))
