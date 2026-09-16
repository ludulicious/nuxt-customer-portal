import type { Billing, Locale } from '@nuxt-customer-portal/products/shared/types'

type AppointmentCalendarDescriptionInput = {
  start: Date
  end: Date
  providerTimezone: string
  customerTimezone: string
  locale: Locale
  billing: Billing
  email: string
  meetingUrl?: string | null
  graceMinutes: number
}

const labels = {
  en: {
    appointmentTime: 'Appointment time',
    client: 'Client',
    clientTime: 'Client time',
    grace: (minutes: number) => `${minutes} minutes grace time after this appointment. Manage in the portal.`
  },
  nl: {
    appointmentTime: 'Afspraaktijd',
    client: 'Klant',
    clientTime: 'Tijd van de klant',
    grace: (minutes: number) => `${minutes} minuten uitlooptijd na deze afspraak. Beheer dit in het portaal.`
  }
} as const

function timezoneRange(start: Date, end: Date, timezone: string, locale: Locale) {
  const formatter = new Intl.DateTimeFormat(locale, {
    dateStyle: 'long',
    timeStyle: 'short',
    timeZone: timezone
  })
  return formatter.formatRange(start, end)
}

function countryName(country: string, locale: Locale) {
  if (!country) return ''
  try {
    return new Intl.DisplayNames([locale], { type: 'region' }).of(country.toUpperCase()) || country
  } catch {
    return country
  }
}

export function appointmentCalendarTitle(title: string, billing: Billing) {
  const clientName = billing.name || [billing.firstName, billing.lastName].filter(Boolean).join(' ')
  return clientName ? `${clientName} - ${title}` : title
}

export function appointmentCalendarDescription(input: AppointmentCalendarDescriptionInput) {
  const text = labels[input.locale]
  const clientName = input.billing.name || [input.billing.firstName, input.billing.lastName].filter(Boolean).join(' ')
  const client = [clientName, input.email, countryName(input.billing.country, input.locale)].filter(Boolean)
  const sections = [
    [
      `${text.appointmentTime}:`,
      input.providerTimezone.replaceAll('_', ' '),
      timezoneRange(input.start, input.end, input.providerTimezone, input.locale)
    ].join('\n'),
    [`${text.client}:`, ...client].join('\n')
  ]

  if (input.customerTimezone && input.customerTimezone !== input.providerTimezone) {
    sections.push(
      [
        `${text.clientTime}:`,
        input.customerTimezone.replaceAll('_', ' '),
        timezoneRange(input.start, input.end, input.customerTimezone, input.locale)
      ].join('\n')
    )
  }
  if (input.meetingUrl) sections.push(input.meetingUrl)
  sections.push(text.grace(input.graceMinutes))
  return sections.join('\n\n')
}
