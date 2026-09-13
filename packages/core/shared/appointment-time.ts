export interface AppointmentTimeOptions {
  locale?: string | string[]
  timeZone: string
  midnight: string
  dateStyle?: Intl.DateTimeFormatOptions['dateStyle']
  includeDate?: boolean
}

export function formatAppointmentTime(value: string | Date, options: AppointmentTimeOptions): string {
  const date = new Date(value)
  const parts = new Intl.DateTimeFormat('en', {
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZone: options.timeZone
  }).formatToParts(date)
  if (
    parts.find((part) => part.type === 'hour')?.value === '00' &&
    parts.find((part) => part.type === 'minute')?.value === '00'
  ) {
    return options.midnight
  }
  return new Intl.DateTimeFormat(options.locale, { timeStyle: 'short', timeZone: options.timeZone }).format(date)
}

export function formatAppointmentRange(
  start: string | Date,
  end: string | Date,
  options: AppointmentTimeOptions
): string {
  if (options.includeDate === false) {
    return `${formatAppointmentTime(start, options)} – ${formatAppointmentTime(end, options)}`
  }
  const formatter = new Intl.DateTimeFormat(options.locale, {
    dateStyle: options.dateStyle ?? 'long',
    timeStyle: 'short',
    timeZone: options.timeZone
  })
  const endTime = formatAppointmentTime(end, options)
  return endTime === options.midnight
    ? `${formatter.format(new Date(start))} – ${options.midnight}`
    : formatter.formatRange(new Date(start), new Date(end))
}
