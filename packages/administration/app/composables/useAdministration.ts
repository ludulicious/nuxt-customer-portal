import type { AdminUsersResponse, MemberRole } from '@nuxt-customer-portal/core/shared/types/index'

export const useAdministration = () => {
  const searchUsers = async (search: string) => await $fetch<AdminUsersResponse>('/api/admin/users', {
    query: search.trim() ? { search: search.trim() } : undefined
  })

  const linkOrganizationMember = async (organizationId: string, input: { userId: string, role: MemberRole }) => await $fetch(
    `/api/admin/organizations/${organizationId}/members`,
    { method: 'POST', body: input }
  )

  return { searchUsers, linkOrganizationMember }
}
