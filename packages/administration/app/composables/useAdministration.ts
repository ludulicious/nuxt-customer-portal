import type {
  AdminUserResponse,
  AdminUsersResponse,
  MemberRole,
  UpdateUserRoleRequest,
  UpdateUserRoleResponse
} from '@nuxt-customer-portal/core/shared/types/index'

export const useAdministration = () => {
  const searchUsers = async (search: string) => await $fetch<AdminUsersResponse>('/api/admin/users', {
    query: search.trim() ? { search: search.trim() } : undefined
  })

  const getUser = async (id: string) => await $fetch<AdminUserResponse>(`/api/admin/users/${id}`)

  const updateUserRole = async (id: string, input: UpdateUserRoleRequest) => await $fetch<UpdateUserRoleResponse>(
    `/api/admin/users/${id}/role`,
    { method: 'PATCH', body: input }
  )

  const linkOrganizationMember = async (organizationId: string, input: { userId: string, role: MemberRole }) => await $fetch(
    `/api/admin/organizations/${organizationId}/members`,
    { method: 'POST', body: input }
  )

  return { searchUsers, getUser, updateUserRole, linkOrganizationMember }
}
