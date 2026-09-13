const escape = (value: string) =>
  value.replace(/\\/g, '\\\\').replace(/\r?\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;')
const stamp = (date: Date) =>
  date
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '')
export function calendarInvitation(input: {
  id: string
  revision: number
  title: string
  start: Date
  end: Date
  organizer: string
  attendee: string
  url?: string | null
  cancelled: boolean
  now?: Date
}) {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Nuxt Customer Portal//Planning//EN',
    `METHOD:${input.cancelled ? 'CANCEL' : 'REQUEST'}`,
    'BEGIN:VEVENT',
    `UID:${input.id}@portal-planning`,
    `SEQUENCE:${input.revision}`,
    `DTSTAMP:${stamp(input.now || new Date())}`,
    `DTSTART:${stamp(input.start)}`,
    `DTEND:${stamp(input.end)}`,
    `SUMMARY:${escape(input.title)}`,
    `ORGANIZER:mailto:${input.organizer}`,
    `ATTENDEE;RSVP=TRUE:mailto:${input.attendee}`,
    `STATUS:${input.cancelled ? 'CANCELLED' : 'CONFIRMED'}`,
    ...(input.url ? [`LOCATION:${escape(input.url)}`, `DESCRIPTION:${escape(input.url)}`] : []),
    'END:VEVENT',
    'END:VCALENDAR'
  ]
  // Fold by UTF-8 bytes, including the continuation space.
  return (
    lines
      .flatMap((line) => {
        const parts: string[] = []
        let part = ''
        for (const char of line) {
          if (Buffer.byteLength(part + char) > 74) {
            parts.push(part)
            part = ' ' + char
          } else {
            part += char
          }
        }
        parts.push(part)
        return parts
      })
      .join('\r\n') + '\r\n'
  )
}
