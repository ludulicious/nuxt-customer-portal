export const createHoursIntroduction = (entries: Array<{ person: string; date: string }>, locale: 'nl' | 'en') => {
  if (!entries.length) {
    return ''
  }
  const names = [...new Set(entries.map((entry) => entry.person))].sort()
  const people = new Intl.ListFormat(locale, { style: 'long', type: 'conjunction' }).format(names)
  const dates = entries.map((entry) => entry.date).sort()
  const format = (date: string) =>
    new Intl.DateTimeFormat(locale, {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC'
    }).format(new Date(`${date}T12:00:00Z`))
  const start = dates[0]!
  const end = dates[dates.length - 1]!
  const period = start === end ? format(start) : `${format(start)} ${locale === 'nl' ? 't/m' : 'to'} ${format(end)}`
  return locale === 'nl'
    ? `Hierbij factureren wij de uren van ${people} over de periode ${period}.`
    : `We hereby invoice the hours worked by ${people} for the period ${period}.`
}
