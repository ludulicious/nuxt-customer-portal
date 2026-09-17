export const useTimezonePreferences = () => ({
  get: () =>
    $fetch<{
      providerTimezone: string
      clientTimezone: string | null
      userTimezone: string | null
      schedulingTimezone: string
      displayTimezone: string
    }>('/api/timezones'),
  saveUser: (timezone: string | null) => $fetch('/api/profile', { method: 'PATCH', body: { timezone } }),
  saveProvider: (timezone: string) => $fetch('/api/provider-timezone', { method: 'PATCH', body: { timezone } })
})
