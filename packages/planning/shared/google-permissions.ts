const calendar = 'https://www.googleapis.com/auth/calendar'
export const googleCalendarScopes = [`${calendar}.events`, `${calendar}.calendarlist.readonly`, `${calendar}.freebusy`]

export function hasGoogleCalendarPermissions(scope: string | undefined) {
  const granted = new Set((scope || '').split(/\s+/))
  return (
    granted.has(calendar) ||
    (granted.has(`${calendar}.events`) &&
      (granted.has(`${calendar}.calendarlist.readonly`) ||
        granted.has(`${calendar}.calendarlist`) ||
        granted.has(`${calendar}.readonly`)) &&
      (granted.has(`${calendar}.freebusy`) ||
        granted.has(`${calendar}.events.freebusy`) ||
        granted.has(`${calendar}.readonly`)))
  )
}
