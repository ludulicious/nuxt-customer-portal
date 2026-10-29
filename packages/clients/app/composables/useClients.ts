import type { GenericClientDto, ClientListResponse } from '@nuxt-customer-portal/clients/shared/types/client'

export const useClients = () => ({
  invitablePrivateClients: () =>
    $fetch<{ id: string; name: string; email: string | null }[], string>('/api/admin/private-client-invitations'),
  invitePrivateClient: (input: {
    requestId: string
    email: string
    clientId?: string
    name?: string
    preferredLocale?: 'en' | 'nl'
  }) =>
    $fetch<{ invitationId: string; deliveryFailed: boolean }, string>('/api/admin/private-client-invitations', {
      method: 'POST',
      body: input
    }),
  personalAddress: () => $fetch<{ address: string; archived: boolean } | null, string>('/api/personal-client/address'),
  updatePersonalAddress: (address: string) =>
    $fetch<{ address: string; archived: boolean }, string>('/api/personal-client/address', {
      method: 'PATCH',
      body: { address }
    }),
  onboard: (input: { firstName: string; lastName: string; preferredLocale: 'nl' | 'en'; timezone: string | null }) =>
    $fetch<GenericClientDto, string>('/api/personal-client', { method: 'POST', body: input }),
  list: (query: Record<string, string | number | undefined>) =>
    $fetch<ClientListResponse, string>('/api/clients', { query }),
  get: (id: string) => $fetch<GenericClientDto, string>(`/api/clients/${id}`),
  create: (input: Record<string, unknown>) =>
    $fetch<GenericClientDto, string>('/api/clients', { method: 'POST', body: input }),
  update: (id: string, input: Record<string, unknown>) =>
    $fetch<GenericClientDto, string>(`/api/clients/${id}`, { method: 'PATCH', body: input }),
  archive: (id: string, archived: boolean) =>
    $fetch<GenericClientDto, string>(`/api/clients/${id}/archive`, { method: 'PATCH', body: { archived } }),
  setModule: (id: string, moduleId: string, enabled: boolean) =>
    $fetch<GenericClientDto, string>(`/api/clients/${id}/modules/${moduleId}`, { method: 'PUT', body: { enabled } }),
  invite: (id: string, email: string, role: string) =>
    $fetch<unknown, string>(`/api/clients/${id}/invitations`, { method: 'POST', body: { email, role } }),
  updateMember: (id: string, memberId: string, input: Record<string, unknown>) =>
    $fetch<unknown, string>(`/api/clients/${id}/members/${memberId}`, { method: 'PATCH', body: input }),
  removeMember: (id: string, memberId: string) =>
    $fetch<unknown, string>(`/api/clients/${id}/members/${memberId}`, { method: 'DELETE' as never }),
  deletion: (id: string) =>
    $fetch<{ canDelete: boolean; memberCount: number; moduleCount: number; clientName: string }, string>(
      `/api/clients/${id}/deletion`
    ),
  remove: (id: string, clientName: string) =>
    $fetch<unknown, string>(`/api/clients/${id}`, { method: 'DELETE' as never, body: { clientName } })
})
