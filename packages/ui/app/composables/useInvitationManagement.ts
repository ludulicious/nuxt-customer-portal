export const useInvitationManagement = () => ({
  changeRole: (endpoint: string, role: string) => $fetch(endpoint, { method: 'PATCH', body: { role } }),
  revoke: (endpoint: string) => $fetch(endpoint, { method: 'PATCH', body: { status: 'canceled' } })
})
