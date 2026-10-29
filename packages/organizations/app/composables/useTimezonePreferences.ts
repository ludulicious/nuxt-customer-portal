export const useTimezonePreferences = () => ({
  get: () =>
    $fetch<
      {
        providerTimezone: string
        clientTimezone: string | null
        userTimezone: string | null
        schedulingTimezone: string
        displayTimezone: string
      },
      string
    >('/api/timezones'),
  saveUser: (timezone: string | null) =>
    $fetch<unknown, string>('/api/profile', { method: 'PATCH', body: { timezone } }),
  saveProvider: (timezone: string) =>
    $fetch<unknown, string>('/api/provider-timezone', { method: 'PATCH', body: { timezone } })
})
