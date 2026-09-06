export const useServiceRequestMenu = () => {
  const { activeOrganizationRole } = usePortalSession()
  const { t } = useI18n()

  const isOrganizationAdmin = computed(() => {
    const role = activeOrganizationRole.value
    return role === 'owner' || role === 'admin'
  })

  const menuItems = computed(() => {
    const items = [
      {
        label: t('features.serviceRequests.navigation.myRequests'),
        to: '/requests',
        icon: 'i-lucide-ticket'
      }
    ]

    return items
  })

  return {
    menuItems: readonly(menuItems),
    isOrganizationAdmin: readonly(isOrganizationAdmin)
  }
}
