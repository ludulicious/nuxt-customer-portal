export const usePortalSession = () => {
  const userStore = useUserStore()
  const {
    activeOrganizationId,
    activeOrganizationRole,
    activeOrganizationType,
    currentUser,
    isAdmin,
    isAuthenticated
  } = storeToRefs(userStore)

  return {
    activeOrganizationId: readonly(activeOrganizationId),
    activeOrganizationRole: readonly(activeOrganizationRole),
    activeOrganizationType: readonly(activeOrganizationType),
    currentUser: readonly(currentUser),
    isSystemAdmin: readonly(isAdmin),
    isAuthenticated: readonly(isAuthenticated)
  }
}
