export const useInvitationManagement = () => ({
  changeRole: (endpoint: string, role: string) =>
    $fetch<unknown, string>(endpoint, { method: 'PATCH', body: { role } }),
  resend: (endpoint: string) => $fetch<unknown, string>(`${endpoint}/resend`, { method: 'POST' }),
  revoke: (endpoint: string) => $fetch<unknown, string>(endpoint, { method: 'PATCH', body: { status: 'canceled' } })
})
