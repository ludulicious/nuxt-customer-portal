/** Named zones retain daylight-saving rules; offsets do not. */
export const DEFAULT_TIMEZONE = 'Europe/Amsterdam'
export const isValidTimezone = (value: string): boolean => {
  if (!value || /^[+-]/.test(value)) {
    return false
  }
  try {
    new Intl.DateTimeFormat('en', { timeZone: value }).format()
    return true
  } catch {
    return false
  }
}
export const resolveTimezones = (input: {
  providerTimezone: string
  clientTimezone?: string | null
  userTimezone?: string | null
}) => {
  const schedulingTimezone = input.clientTimezone || input.providerTimezone
  return { ...input, schedulingTimezone, displayTimezone: input.userTimezone || schedulingTimezone }
}
