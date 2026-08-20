import type { GenericClientDto, ClientListResponse } from '@nuxt-customer-portal/clients/shared/types/client'

export const useClients = () => ({
  ...(() => {
    const requestFetch = useRequestFetch()
    return {
      list: (query: Record<string, string | number | undefined>) => requestFetch<ClientListResponse>('/api/clients', { query }),
      get: (id: string) => requestFetch<GenericClientDto>(`/api/clients/${id}`),
      create: (input: Record<string, unknown>) => requestFetch<GenericClientDto>('/api/clients', { method: 'POST', body: input }),
      update: (id: string, input: Record<string, unknown>) => requestFetch<GenericClientDto>(`/api/clients/${id}`, { method: 'PATCH', body: input }),
      archive: (id: string, archived: boolean) => requestFetch<GenericClientDto>(`/api/clients/${id}/archive`, { method: 'PATCH', body: { archived } }),
      setModule: (id: string, moduleId: string, enabled: boolean) => requestFetch<GenericClientDto>(`/api/clients/${id}/modules/${moduleId}`, { method: 'PUT', body: { enabled } }),
      invite: (id: string, email: string, role: string) => requestFetch(`/api/clients/${id}/invitations`, { method: 'POST', body: { email, role } }),
      updateMember: (id: string, memberId: string, input: Record<string, unknown>) => requestFetch(`/api/clients/${id}/members/${memberId}`, { method: 'PATCH', body: input }),
      removeMember: (id: string, memberId: string) => requestFetch(`/api/clients/${id}/members/${memberId}`, { method: 'DELETE' as never }),
      deletion: (id: string) => requestFetch<{ canDelete: boolean, memberCount: number, moduleCount: number, clientName: string }>(`/api/clients/${id}/deletion`),
      remove: (id: string, clientName: string) => requestFetch(`/api/clients/${id}`, { method: 'DELETE' as never, body: { clientName } })
    }
  })()
})
