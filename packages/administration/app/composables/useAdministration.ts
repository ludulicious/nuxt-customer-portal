import type {
  AdminUserResponse,
  AdminUsersResponse,
  MemberRole,
  UpdateUserRoleRequest,
  UpdateUserRoleResponse
} from '@nuxt-customer-portal/core/shared/types/index'

export const useAdministration = () => {
  const keys = () =>
    $fetch<
      Array<{
        id: string
        name: string | null
        prefix: string | null
        expiresAt: string | null
        enabled: boolean
        lastUsedAt: string | null
        createdAt: string
        permissions: Record<string, string[]>
      }>
    >('/api/admin/api-keys', { cache: 'no-store' })
  const createKey = (body: Record<string, unknown>) =>
    $fetch<{ key: string }>('/api/admin/api-keys', { method: 'POST', body })
  const revoke = (id: string) => $fetch(`/api/admin/api-keys/${id}`, { method: 'DELETE' })
  const listInvitations = (page: number, search: string) =>
    $fetch<{
      items: Array<{
        id: string
        email: string
        role: string | null
        organizationId: string
        organizationName: string
        isPersonalClient: boolean
        expiresAt: string
      }>
      total: number
    }>('/api/admin/invitations', { query: { page, search } })
  const searchUsers = async (search: string) =>
    await $fetch<AdminUsersResponse>('/api/admin/users', {
      query: search.trim() ? { search: search.trim() } : undefined
    })

  const getUser = async (id: string) => await $fetch<AdminUserResponse>(`/api/admin/users/${id}`)

  const updateUserRole = async (id: string, input: UpdateUserRoleRequest) =>
    await $fetch<UpdateUserRoleResponse>(`/api/admin/users/${id}/role`, { method: 'PATCH', body: input })

  const linkOrganizationMember = async (organizationId: string, input: { userId: string; role: MemberRole }) =>
    await $fetch(`/api/admin/organizations/${organizationId}/members`, { method: 'POST', body: input })

  return { keys, createKey, revoke, searchUsers, getUser, updateUserRole, linkOrganizationMember, listInvitations }
}
