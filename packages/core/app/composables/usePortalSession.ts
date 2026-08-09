export const usePortalSession = () => {
  const userStore = useUserStore()
  const {
    activeOrganizationId,
    activeOrganizationRole,
    currentUser,
    isAdmin,
    isAuthenticated
  } = storeToRefs(userStore)

  return {
    activeOrganizationId: readonly(activeOrganizationId),
    activeOrganizationRole: readonly(activeOrganizationRole),
    currentUser: readonly(currentUser),
    isSystemAdmin: readonly(isAdmin),
    isAuthenticated: readonly(isAuthenticated)
  }
}
