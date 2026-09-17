export const usePortalSession = () => {
  const userStore = useUserStore()
  const {
    activeOrganizationId,
    activeOrganizationRole,
    activeOrganizationType,
    activeOrganizationIsPersonal,
    currentUser,
    isAdmin,
    isAuthenticated
  } = storeToRefs(userStore)

  return {
    activeOrganizationId: readonly(activeOrganizationId),
    activeOrganizationRole: readonly(activeOrganizationRole),
    activeOrganizationType: readonly(activeOrganizationType),
    activeOrganizationIsPersonal: readonly(activeOrganizationIsPersonal),
    currentUser: readonly(currentUser),
    isSystemAdmin: readonly(isAdmin),
    isAuthenticated: readonly(isAuthenticated)
  }
}
