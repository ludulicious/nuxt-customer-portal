import { z } from 'zod'

export const recurrencePeriods = ['daily', 'weekly', 'monthly', 'quarterly', 'yearly'] as const
export type RecurrencePeriod = (typeof recurrencePeriods)[number]
export const periodPlaceholders = [
  'period',
  'month',
  'year',
  'week',
  'week_year',
  'period_start',
  'period_end',
  'previous_period',
  'previous_month',
  'previous_year',
  'previous_week',
  'previous_week_year',
  'previous_period_start',
  'previous_period_end'
] as const
export const calendarDateSchema = z.iso.date().refine((value) => value >= '1900-01-01' && value <= '9998-12-31')
const templateText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .refine(
      (value) =>
        !/\{\{|\}\}/.test(
          value.replace(/\{\{\s*(\w+)\s*\}\}/g, (match, key) => (periodPlaceholders.includes(key) ? '' : match))
        ),
      'Unknown or malformed period placeholder'
    )
export const recurringInvoiceSchema = z
  .object({
    name: z.string().trim().min(1).max(200),
    period: z.enum(recurrencePeriods),
    startDate: calendarDateSchema,
    endDate: calendarDateSchema.nullable(),
    timeZone: z
      .string()
      .min(1)
      .max(100)
      .refine((value) => {
        try {
          new Intl.DateTimeFormat('en', { timeZone: value }).format()
          return true
        } catch {
          return false
        }
      }, 'Invalid timezone'),
    locale: z.enum(['en', 'nl']),
    paymentTermDays: z.number().int().min(0).max(365),
    enabled: z.boolean(),
    clientOrganizationId: z.string().trim().min(1).max(200),
    contactId: z.string().trim().min(1).max(200).nullable(),
    currency: z.string().regex(/^[A-Z]{3}$/),
    subject: templateText(500).nullable(),
    notes: templateText(5000).nullable(),
    lines: z
      .array(
        z.object({
          description: templateText(500).refine((value) => value.length > 0),
          quantityMilli: z.number().int().positive().max(100_000_000),
          unit: z.string().trim().min(1).max(30),
          unitPriceMinor: z.number().int().min(0).max(1_000_000_000),
          vatRateBasisPoints: z.number().int().min(0).max(10_000)
        })
      )
      .min(1)
      .max(500)
  })
  .refine((value) => !value.endDate || value.endDate >= value.startDate, {
    path: ['endDate'],
    message: 'End date must not precede start date'
  })
export type RecurringInvoiceInput = z.infer<typeof recurringInvoiceSchema>
export interface RecurringInvoiceDto extends RecurringInvoiceInput {
  id: string
  nextDate: string | null
  lastGeneratedDate: string | null
  lastError: string | null
}

export const addCalendarDays = (value: string, days: number) => {
  const date = new Date(`${value}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

const shiftRecurrenceDate = (
  startDate: string,
  period: RecurrencePeriod,
  occurrence: string,
  direction: 1 | -1
): string => {
  if (period === 'daily' || period === 'weekly') {
    return addCalendarDays(occurrence, (period === 'daily' ? 1 : 7) * direction)
  }
  const anchor = new Date(`${startDate}T00:00:00Z`)
  const current = new Date(`${occurrence}T00:00:00Z`)
  const months = period === 'monthly' ? 1 : period === 'quarterly' ? 3 : 12
  const next = new Date(Date.UTC(current.getUTCFullYear(), current.getUTCMonth() + months * direction, 1))
  const lastDay = new Date(Date.UTC(next.getUTCFullYear(), next.getUTCMonth() + 1, 0)).getUTCDate()
  next.setUTCDate(Math.min(anchor.getUTCDate(), lastDay))
  return next.toISOString().slice(0, 10)
}

export const nextRecurrenceDate = (startDate: string, period: RecurrencePeriod, occurrence: string): string =>
  shiftRecurrenceDate(startDate, period, occurrence, 1)

export const dateInTimeZone = (now: Date, timeZone: string) => {
  const parts = new Intl.DateTimeFormat('en', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(now)
  const part = (type: string) => parts.find((entry) => entry.type === type)!.value
  return `${part('year')}-${part('month')}-${part('day')}`
}

const periodValues = (schedule: Pick<RecurringInvoiceInput, 'startDate' | 'period' | 'locale'>, occurrence: string) => {
  const date = new Date(`${occurrence}T00:00:00Z`)
  const thursday = new Date(date)
  thursday.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7))
  const weekYear = thursday.getUTCFullYear()
  const week = Math.ceil(((thursday.getTime() - Date.UTC(weekYear, 0, 1)) / 86_400_000 + 1) / 7)
  const month = new Intl.DateTimeFormat(schedule.locale, { month: 'long', timeZone: 'UTC' }).format(date)
  const year = String(date.getUTCFullYear())
  const period =
    schedule.period === 'weekly'
      ? `Week ${week} ${weekYear}`
      : schedule.period === 'daily'
        ? occurrence
        : schedule.period === 'yearly'
          ? year
          : schedule.period === 'quarterly'
            ? `Q${Math.floor(date.getUTCMonth() / 3) + 1} ${year}`
            : `${month} ${year}`
  return {
    period,
    month,
    year,
    week: String(week),
    week_year: String(weekYear),
    period_start: occurrence,
    period_end: addCalendarDays(nextRecurrenceDate(schedule.startDate, schedule.period, occurrence), -1)
  }
}

export const renderPeriodText = (
  text: string | null,
  schedule: Pick<RecurringInvoiceInput, 'startDate' | 'period' | 'locale'>,
  occurrence: string
): string | null => {
  if (text === null) {
    return null
  }
  const previousStart = shiftRecurrenceDate(schedule.startDate, schedule.period, occurrence, -1)
  const previous = {
    ...periodValues(schedule, previousStart),
    period_end: addCalendarDays(occurrence, -1)
  }
  const values: Record<string, string> = {
    ...periodValues(schedule, occurrence),
    ...Object.fromEntries(Object.entries(previous).map(([key, value]) => [`previous_${key}`, value]))
  }
  return text.replace(/\{\{\s*(\w+)\s*\}\}/g, (match, key: string) => values[key] ?? match)
}
