export const useInvitationManagement = () => ({
  changeRole: (endpoint: string, role: string) => $fetch(endpoint, { method: 'PATCH', body: { role } }),
  resend: (endpoint: string) => $fetch(`${endpoint}/resend`, { method: 'POST' }),
  revoke: (endpoint: string) => $fetch(endpoint, { method: 'PATCH', body: { status: 'canceled' } })
})
