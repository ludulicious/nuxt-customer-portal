import type { GenericClientDto, ClientListResponse } from '@nuxt-customer-portal/clients/shared/types/client'

export const useClients = () => ({
  list: (query: Record<string, string | number | undefined>) => $fetch<ClientListResponse>('/api/clients', { query }),
  get: (id: string) => $fetch<GenericClientDto>(`/api/clients/${id}`),
  create: (input: Record<string, unknown>) => $fetch<GenericClientDto>('/api/clients', { method: 'POST', body: input }),
  update: (id: string, input: Record<string, unknown>) =>
    $fetch<GenericClientDto>(`/api/clients/${id}`, { method: 'PATCH', body: input }),
  archive: (id: string, archived: boolean) =>
    $fetch<GenericClientDto>(`/api/clients/${id}/archive`, { method: 'PATCH', body: { archived } }),
  setModule: (id: string, moduleId: string, enabled: boolean) =>
    $fetch<GenericClientDto>(`/api/clients/${id}/modules/${moduleId}`, { method: 'PUT', body: { enabled } }),
  invite: (id: string, email: string, role: string) =>
    $fetch(`/api/clients/${id}/invitations`, { method: 'POST', body: { email, role } }),
  updateMember: (id: string, memberId: string, input: Record<string, unknown>) =>
    $fetch(`/api/clients/${id}/members/${memberId}`, { method: 'PATCH', body: input }),
  removeMember: (id: string, memberId: string) =>
    $fetch(`/api/clients/${id}/members/${memberId}`, { method: 'DELETE' as never }),
  deletion: (id: string) =>
    $fetch<{ canDelete: boolean; memberCount: number; moduleCount: number; clientName: string }>(
      `/api/clients/${id}/deletion`
    ),
  remove: (id: string, clientName: string) =>
    $fetch(`/api/clients/${id}`, { method: 'DELETE' as never, body: { clientName } })
})
