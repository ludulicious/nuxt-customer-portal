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

const dateInTimezone = (date: Date, timezone: string) => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(date)
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find(part => part.type === type)?.value ?? ''
  return `${value('year')}-${value('month')}-${value('day')}`
}

export const invoiceOverdueDetails = (
  dueDate: string,
  status: string,
  outstandingMinor: number,
  timezone: string,
  now = new Date()
) => {
  const today = dateInTimezone(now, timezone)
  const isOverdue = status === 'ISSUED' && outstandingMinor > 0 && dueDate < today
  if (!isOverdue) return { isOverdue: false, daysOverdue: 0 }
  const due = new Date(`${dueDate}T12:00:00Z`)
  const current = new Date(`${today}T12:00:00Z`)
  return { isOverdue: true, daysOverdue: Math.round((current.getTime() - due.getTime()) / 86_400_000) }
}
